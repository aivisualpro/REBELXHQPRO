import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-response';
import dbConnect from '@/lib/mongoose';
import Manufacturing from '@/models/Manufacturing';
import AnomalyReview from '@/models/AnomalyReview';
import Sku from '@/models/Sku';
import { callLLM, hashString } from '@/lib/llm-provider';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        await dbConnect();
        
        const { searchParams } = new URL(request.url);
        const forceRefresh = searchParams.get('forceRefresh') === 'true';
        const provider = (searchParams.get('provider') as 'groq' | 'openrouter') || 'groq';
        const model = searchParams.get('model') || (provider === 'groq' ? 'llama-3.3-70b-versatile' : 'openai/gpt-4o-mini');
        
        // 1. Fetch raw data: only Fulfilled MOs in last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const mos = await Manufacturing.find({
            status: 'Fulfilled',
            createdAt: { $gte: thirtyDaysAgo }
        }).select('_id label sku qty qtyDifference lineItems labor createdAt').lean();

        if (mos.length === 0) return apiSuccess([]);

        // 2. Group by SKU to calculate baselines
        const skuGroups = new Map<string, any[]>();
        mos.forEach((mo: any) => {
            if (!mo.sku) return;
            const skuStr = mo.sku.toString();
            if (!skuGroups.has(skuStr)) skuGroups.set(skuStr, []);
            skuGroups.get(skuStr)!.push(mo);
        });

        const allFlags: any[] = [];

        // Simple stat helper
        const getMedian = (arr: number[]) => {
            if (arr.length === 0) return 0;
            arr.sort((a, b) => a - b);
            const mid = Math.floor(arr.length / 2);
            return arr.length % 2 !== 0 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
        };

        // 3. Rule-based detection per SKU
        for (const [skuId, orders] of Array.from(skuGroups.entries())) {
            if (orders.length < 3) continue; // Not enough data for baseline

            // Calculate labor-hours per unit
            const laborStats = orders.map(mo => {
                const moQty = (mo.qty || 0) + (mo.qtyDifference || 0);
                if (moQty <= 0) return { mo, hours: 0, hrsPerUnit: 0 };
                
                let totalHours = 0;
                mo.labor?.forEach((l: any) => {
                    const parts = (l.duration || '0:0:0').split(':');
                    totalHours += parseInt(parts[0] || '0') + parseInt(parts[1] || '0') / 60 + parseInt(parts[2] || '0') / 3600;
                });
                return { mo, hours: totalHours, hrsPerUnit: totalHours / moQty };
            }).filter(s => s.hours > 0);

            if (laborStats.length < 3) continue;

            const medianHrsPerUnit = getMedian(laborStats.map(s => s.hrsPerUnit));
            // Let's flag any MO where hrsPerUnit is > 2x the median
            const threshold = medianHrsPerUnit * 2;

            for (const stat of laborStats) {
                if (stat.hrsPerUnit > threshold && threshold > 0) {
                    allFlags.push({
                        skuId,
                        moLegacyId: stat.mo.label,
                        moId: stat.mo._id,
                        type: 'labor-outlier',
                        actual: stat.hrsPerUnit,
                        baseline: medianHrsPerUnit,
                        context: `MO#${stat.mo.label} took ${stat.hours.toFixed(1)} hours for ${(stat.mo.qty || 0) + (stat.mo.qtyDifference || 0)} units (${stat.hrsPerUnit.toFixed(2)} hrs/unit). Median is ${medianHrsPerUnit.toFixed(2)} hrs/unit across ${laborStats.length} orders.`
                    });
                }
                
                // Suspicious Rounding (e.g. exactly 8.0 hours or 4.0 hours, indicating not using timeclock)
                if (stat.hours > 0 && stat.hours % 1 === 0 && stat.hours >= 4) {
                     allFlags.push({
                        skuId,
                        moLegacyId: stat.mo.label,
                        moId: stat.mo._id,
                        type: 'suspicious-rounding',
                        actual: stat.hours,
                        baseline: 0,
                        context: `MO#${stat.mo.label} has exactly ${stat.hours} hours logged. Manual estimation is highly likely.`
                    });
                }
            }
        }

        if (allFlags.length === 0) return apiSuccess([]);

        // Limit flags for LLM to avoid context limits
        const topFlags = allFlags.slice(0, 15);

        // 4. Check cache
        const datasetStr = JSON.stringify(topFlags.map(f => ({ mo: f.moLegacyId, type: f.type, ctx: f.context })));
        const promptVersion = 'v1-anomaly-explanation';
        const dHash = hashString(datasetStr);

        if (!forceRefresh) {
            const cachedReviews = await AnomalyReview.find({ datasetHash: dHash, promptVersion }).lean();
            if (cachedReviews.length > 0) {
                // Return cached populated with SKU names
                await Sku.populate(cachedReviews, { path: 'skuId', select: 'name' });
                return apiSuccess(cachedReviews);
            }
        }

        // 5. Build LLM prompt
        const systemPrompt = `You are a manufacturing operations analyst. You detect process deviations and recommend actionable steps to plant managers. Be concise, highly professional, and pragmatic. Return JSON only.`;
        const userPrompt = `I have detected ${topFlags.length} statistical anomalies in my manufacturing data. 
Here they are:
${JSON.stringify(topFlags, null, 2)}

For each anomaly, rank them by likelihood of being a real issue vs. noise. 
Explain the probable root cause in one short sentence, and suggest one concrete follow-up action.

Return JSON in this EXACT schema:
{
  "reviews": [
    {
      "moLegacyId": "string (match input)",
      "type": "string (match input)",
      "severity": "high" | "medium" | "low",
      "probableCause": "string",
      "recommendedAction": "string",
      "confidence": "number between 0 and 100"
    }
  ]
}
Do not include any markdown fences outside the JSON.`;

        // 6. Call LLM
        let aiResult: any;
        try {
            const llmResponse = await callLLM({
                systemPrompt,
                userPrompt,
                model,
                provider,
                responseFormat: 'json_object'
            });

            aiResult = JSON.parse(llmResponse.content);
            if (!aiResult.reviews) throw new Error('Invalid JSON structure from LLM');

            // Merge back and save
            const newReviews = [];
            for (const flag of topFlags) {
                const llmReview = aiResult.reviews.find((r: any) => r.moLegacyId === flag.moLegacyId && r.type === flag.type);
                if (llmReview) {
                    const review = await AnomalyReview.findOneAndUpdate(
                        { moId: flag.moId, type: flag.type },
                        {
                            datasetHash: dHash,
                            promptVersion,
                            skuId: flag.skuId,
                            moLegacyId: flag.moLegacyId,
                            moId: flag.moId,
                            type: flag.type,
                            severity: llmReview.severity,
                            probableCause: llmReview.probableCause,
                            recommendedAction: llmReview.recommendedAction,
                            confidence: llmReview.confidence,
                            baseline: flag.baseline,
                            actual: flag.actual,
                            llmProvider: provider,
                            llmModel: llmResponse.modelInfo,
                            llmTokensPrompt: llmResponse.usage?.promptTokens,
                            llmTokensCompletion: llmResponse.usage?.completionTokens
                        },
                        { upsert: true, new: true }
                    );
                    newReviews.push(review);
                }
            }

            await Sku.populate(newReviews, { path: 'skuId', select: 'name' });
            return apiSuccess(newReviews);

        } catch (e: any) {
            console.error('LLM parsing error', e);
            // Fallback: return raw statistical flags if AI fails
            return apiSuccess(topFlags.map(f => ({
                ...f, 
                severity: 'medium', 
                probableCause: 'AI generation failed - ' + f.context,
                recommendedAction: 'Manual review required.'
            })));
        }

    } catch (error: any) {
        console.error('Anomalies API Error:', error);
        return apiError(error.message, 500);
    }
}

// Mark reviewed, dismissed, etc.
export async function PATCH(request: NextRequest) {
    try {
        await dbConnect();
        const body = await request.json();
        const { _id, status, resolutionNotes } = body;

        const updated = await AnomalyReview.findByIdAndUpdate(
            _id,
            { status, resolutionNotes, reviewedAt: new Date() },
            { new: true }
        );

        return apiSuccess(updated);
    } catch (error: any) {
        return apiError(error.message, 500);
    }
}
