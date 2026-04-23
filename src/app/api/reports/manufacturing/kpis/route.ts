import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-response';
import dbConnect from '@/lib/mongoose';
import Manufacturing from '@/models/Manufacturing';
import Sku from '@/models/Sku';
import { getGlobalStartDate } from '@/lib/global-settings';

export const dynamic = 'force-dynamic';

/* ── Configurable Thresholds ───────────────────────────────── */
const CFG = {
    laborSigma: 2,
    costSigma: 2,
    yieldVariancePct: 5,
    scrapSigma: 2,
    minSampleSize: 5,
    baselineDays: 180,
};

/* ── Stat Helpers ──────────────────────────────────────────── */
function median(arr: number[]): number {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function stddev(arr: number[], avg: number): number {
    if (arr.length < 2) return 0;
    return Math.sqrt(arr.reduce((s, v) => s + (v - avg) ** 2, 0) / (arr.length - 1));
}
function pct(arr: number[], p: number): number {
    const s = [...arr].sort((a, b) => a - b);
    const i = (p / 100) * (s.length - 1);
    const lo = Math.floor(i), hi = Math.ceil(i);
    return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (i - lo);
}
function parseDuration(d: string): number {
    const p = (d || '0:0:0').split(':');
    return parseInt(p[0] || '0') + parseInt(p[1] || '0') / 60 + parseInt(p[2] || '0') / 3600;
}

/* ── SKU Name Resolver ─────────────────────────────────────── */
async function resolveSkuNames(ids: string[]): Promise<Map<string, string>> {
    const skus = await Sku.find({ _id: { $in: ids } }).select('name').lean();
    return new Map(skus.map((s: any) => [s._id.toString(), s.name || 'Unknown']));
}

/* ── GET ───────────────────────────────────────────────────── */
export async function GET(request: NextRequest) {
    try {
        await dbConnect();
        const { searchParams } = new URL(request.url);
        const drilldown = searchParams.get('drilldown');

        const globalStart = await getGlobalStartDate();
        const dateMatch: any = globalStart ? { createdAt: { $gte: globalStart } } : {};
        const now = new Date();

        if (drilldown) {
            return handleDrilldown(drilldown, dateMatch, now);
        }

        /* ── Summary counts (Parallelized) ────────────────────────── */
        
        const [
            incomplete, 
            scrapMOCount, 
            missingCost, 
            overdue, 
            noBom, 
            unreservedCount,
            noValuation,
            scrapAgg,
            laborMos,
            costMos,
            opDiscMos,
            yieldVarMos,
            reworkMos
        ] = await Promise.all([
            Manufacturing.countDocuments({ ...dateMatch, status: { $ne: 'Fulfilled' } }),
            Manufacturing.countDocuments({ ...dateMatch, 'lineItems.qtyScrapped': { $gt: 0 } }),
            Manufacturing.countDocuments({ ...dateMatch, status: 'Fulfilled', $or: [{ totalCost: 0 }, { totalCost: null }, { totalCost: { $exists: false } }] }),
            Manufacturing.countDocuments({ ...dateMatch, status: { $ne: 'Fulfilled' }, scheduledFinish: { $lt: now } }),
            Manufacturing.countDocuments({ ...dateMatch, $or: [{ recipesId: null }, { recipesId: { $exists: false } }] }),
            Manufacturing.countDocuments({ ...dateMatch, status: { $ne: 'Fulfilled' }, 'lineItems.lotNumber': { $in: [null, '', undefined] } }),
            Manufacturing.countDocuments({ ...dateMatch, status: 'Fulfilled', $or: [{ laborCost: 0 }, { laborCost: null }], 'labor.0': { $exists: true } }),
            
            Manufacturing.aggregate([
                { $match: { ...dateMatch, 'lineItems.qtyScrapped': { $gt: 0 } } },
                { $unwind: '$lineItems' },
                { $group: { _id: null, totalScrap: { $sum: '$lineItems.qtyScrapped' } } }
            ]),

            // For laborAnomalies
            Manufacturing.find({ ...dateMatch, status: 'Fulfilled', 'labor.0': { $exists: true } })
                .select('_id sku labor.user labor.duration').lean(),
                
            // For costOutliers
            Manufacturing.find({ ...dateMatch, status: 'Fulfilled', totalCost: { $gt: 0 } })
                .select('_id sku qty qtyDifference totalCost').lean(),

            // For operatorDiscrepancies
            Manufacturing.find({ ...dateMatch, 'labor.0': { $exists: true } })
                .select('_id label sku labor.user labor.createdAt').lean(),

            // For yieldVariance
            Manufacturing.find({ ...dateMatch, status: 'Fulfilled' })
                .select('_id qty qtyDifference').lean(),

            // For reworkLoops
            Manufacturing.find({ ...dateMatch, 'lineItems.1': { $exists: true } })
                .select('_id lineItems.sku').lean()
        ]);

        const totalScrapQty = scrapAgg.length > 0 ? scrapAgg[0].totalScrap : 0;

        const laborFlags = computeLaborAnomalies(laborMos);
        const costFlags = computeCostOutliers(costMos);
        const opDiscrepancies = computeOperatorDiscrepancies(opDiscMos);

        // Yield Variance
        const yieldVar = yieldVarMos.filter((m: any) => {
            if (!m.qty || m.qty === 0) return false;
            const variance = Math.abs(m.qtyDifference || 0) / m.qty * 100;
            return variance > CFG.yieldVariancePct;
        }).length;

        // Rework Loops
        let reworkCount = 0;
        reworkMos.forEach((m: any) => {
            const skuSet = new Map<string, number>();
            (m.lineItems || []).forEach((li: any) => {
                if (li.sku) skuSet.set(li.sku.toString(), (skuSet.get(li.sku.toString()) || 0) + 1);
            });
            for (const c of skuSet.values()) { 
                if (c > 1) { reworkCount++; break; } 
            }
        });

        return apiSuccess({
            incomplete, scrap: scrapMOCount, scrapQty: totalScrapQty,
            missingCost, laborAnomalies: laborFlags.length, costOutliers: costFlags.length,
            overdue, noBom, unreserved: unreservedCount,
            operatorDiscrepancies: opDiscrepancies.length,
            yieldVariance: yieldVar, noValuation, reworkLoops: reworkCount,
        });
    } catch (err: any) {
        console.error('KPI API Error:', err);
        return apiError(err.message, 500);
    }
}

/* ── Statistical computations ──────────────────────────────── */
function computeLaborAnomalies(mos: any[]) {
    const bySku = new Map<string, { mo: any; hours: number }[]>();
    mos.forEach(mo => {
        let hours = 0;
        (mo.labor || []).forEach((l: any) => { hours += parseDuration(l.duration); });
        if (hours <= 0) return;
        const s = (mo.sku || '').toString();
        if (!bySku.has(s)) bySku.set(s, []);
        bySku.get(s)!.push({ mo, hours });
    });
    const flags: any[] = [];
    bySku.forEach((entries, skuId) => {
        if (entries.length < CFG.minSampleSize) return;
        const hrs = entries.map(e => e.hours);
        const med = median(hrs);
        const avg = hrs.reduce((a, b) => a + b, 0) / hrs.length;
        const sd = stddev(hrs, avg);
        if (sd === 0) return;
        entries.forEach(e => {
            if (Math.abs(e.hours - med) > CFG.laborSigma * sd) {
                flags.push({ ...e, skuId, median: med, p25: pct(hrs, 25), p75: pct(hrs, 75), sd, deviation: ((e.hours - med) / med * 100) });
            }
        });
    });
    return flags;
}

function computeCostOutliers(mos: any[]) {
    const bySku = new Map<string, { mo: any; costPerUnit: number }[]>();
    mos.forEach(mo => {
        const qty = (mo.qty || 0) + (mo.qtyDifference || 0);
        if (qty <= 0 || !mo.totalCost) return;
        const cpu = mo.totalCost / qty;
        const s = (mo.sku || '').toString();
        if (!bySku.has(s)) bySku.set(s, []);
        bySku.get(s)!.push({ mo, costPerUnit: cpu });
    });
    const flags: any[] = [];
    bySku.forEach((entries, skuId) => {
        if (entries.length < CFG.minSampleSize) return;
        const costs = entries.map(e => e.costPerUnit);
        const med = median(costs);
        const avg = costs.reduce((a, b) => a + b, 0) / costs.length;
        const sd = stddev(costs, avg);
        if (sd === 0) return;
        entries.forEach(e => {
            if (Math.abs(e.costPerUnit - med) > CFG.costSigma * sd) {
                flags.push({ ...e, skuId, median: med, sd, deviation: ((e.costPerUnit - med) / med * 100) });
            }
        });
    });
    return flags;
}

function computeOperatorDiscrepancies(mos: any[]) {
    const opDayMap = new Map<string, { moId: string; moLabel: string; date: string }[]>();
    mos.forEach(mo => {
        (mo.labor || []).forEach((l: any) => {
            if (!l.user || !l.createdAt) return;
            const day = new Date(l.createdAt).toISOString().split('T')[0];
            const key = `${l.user}|${day}`;
            if (!opDayMap.has(key)) opDayMap.set(key, []);
            opDayMap.get(key)!.push({ moId: mo._id.toString(), moLabel: mo.label, date: day });
        });
    });
    const flags: any[] = [];
    opDayMap.forEach((entries, key) => {
        const uniqueMOs = new Set(entries.map(e => e.moId));
        if (uniqueMOs.size > 1) {
            flags.push({ operator: key.split('|')[0], date: key.split('|')[1], moIds: [...uniqueMOs], moLabels: entries.map(e => e.moLabel) });
        }
    });
    return flags;
}

/* ── Drill-down handler ────────────────────────────────────── */
async function handleDrilldown(kpi: string, dateMatch: any, now: Date) {
    const enrich = async (mos: any[]) => {
        const allSkuIds = [...new Set(mos.map((m: any) => m.sku).filter(Boolean))];
        const skuMap = await resolveSkuNames(allSkuIds as string[]);
        return mos.map(mo => ({
            _id: mo._id, label: mo.label, sku: mo.sku, skuName: skuMap.get(mo.sku?.toString()) || 'Unknown',
            status: mo.status, qty: mo.qty, qtyDifference: mo.qtyDifference,
            priority: mo.priority, createdAt: mo.createdAt, scheduledFinish: mo.scheduledFinish,
            totalCost: mo.totalCost, materialCost: mo.materialCost, laborCost: mo.laborCost,
            recipesId: mo.recipesId, createdBy: mo.createdBy,
            ageDays: Math.floor((now.getTime() - new Date(mo.createdAt).getTime()) / 86400000),
        }));
    };

    switch (kpi) {
        case 'incomplete': {
            const mos = await Manufacturing.find({ ...dateMatch, status: { $ne: 'Fulfilled' } })
                .select('_id label sku status qty qtyDifference scheduledFinish priority createdAt createdBy')
                .lean();
            return apiSuccess((await enrich(mos)).sort((a, b) => b.ageDays - a.ageDays));
        }

        case 'scrap': {
            const mos = await Manufacturing.find({ ...dateMatch, 'lineItems.qtyScrapped': { $gt: 0 } })
                .select('_id label sku status qty qtyDifference lineItems.qtyScrapped')
                .lean();
            const enriched = await enrich(mos);
            const rows: any[] = [];
            enriched.forEach((mo, idx) => {
                let scrap = 0;
                (mos[idx].lineItems || []).forEach((li: any) => { scrap += li.qtyScrapped || 0; });
                if (scrap > 0) {
                    const planned = (mo.qty || 0) + (mo.qtyDifference || 0);
                    rows.push({ ...mo, scrapQty: scrap, scrapPct: planned > 0 ? (scrap / planned * 100).toFixed(1) : '0' });
                }
            });
            return apiSuccess(rows.sort((a, b) => b.scrapQty - a.scrapQty));
        }

        case 'missingCost': {
            const mos = await Manufacturing.find({ ...dateMatch, status: 'Fulfilled', $or: [{ totalCost: 0 }, { totalCost: null }, { totalCost: { $exists: false } }] })
                .select('_id label sku status qty qtyDifference totalCost createdAt')
                .lean();
            return apiSuccess(await enrich(mos));
        }

        case 'laborAnomalies': {
            // Need all fulfilled MOs to compute baselines, but restrict fields
            const mos = await Manufacturing.find({ ...dateMatch, status: 'Fulfilled' })
                .select('_id label sku status labor.user labor.duration createdAt')
                .lean();
            const flags = computeLaborAnomalies(mos);
            const enrichedFlags = await enrich(flags.map(f => f.mo));
            return apiSuccess(flags.map((f, i) => ({
                ...enrichedFlags[i], laborHours: f.hours.toFixed(1), skuMedian: f.median.toFixed(1),
                p25: f.p25.toFixed(1), p75: f.p75.toFixed(1), deviationPct: f.deviation.toFixed(0),
                operators: [...new Set((f.mo.labor || []).map((l: any) => l.user))],
            })));
        }

        case 'costOutliers': {
            const mos = await Manufacturing.find({ ...dateMatch, status: 'Fulfilled', totalCost: { $gt: 0 } })
                .select('_id label sku status qty qtyDifference totalCost createdAt')
                .lean();
            const flags = computeCostOutliers(mos);
            const enrichedFlags = await enrich(flags.map(f => f.mo));
            return apiSuccess(flags.map((f, i) => ({
                ...enrichedFlags[i], costPerUnit: f.costPerUnit.toFixed(2), skuMedian: f.median.toFixed(2),
                deviationPct: f.deviation.toFixed(0),
            })));
        }

        case 'overdue': {
            const mos = await Manufacturing.find({ ...dateMatch, status: { $ne: 'Fulfilled' }, scheduledFinish: { $lt: now } })
                .select('_id label sku status qty qtyDifference priority scheduledFinish createdAt')
                .lean();
            const enriched = await enrich(mos);
            return apiSuccess(enriched.map(m => ({ ...m, daysOverdue: Math.floor((now.getTime() - new Date(m.scheduledFinish as any).getTime()) / 86400000) })).sort((a, b) => b.daysOverdue - a.daysOverdue));
        }

        case 'noBom': {
            const mos = await Manufacturing.find({ ...dateMatch, $or: [{ recipesId: null }, { recipesId: { $exists: false } }] })
                .select('_id label sku status createdAt createdBy')
                .lean();
            return apiSuccess(await enrich(mos));
        }

        case 'unreserved': {
            const mos = await Manufacturing.find({ ...dateMatch, status: { $ne: 'Fulfilled' }, 'lineItems.lotNumber': { $in: [null, '', undefined] } })
                .select('_id label sku status qty qtyDifference lineItems.sku lineItems.recipeQty lineItems.lotNumber')
                .lean();
            const enriched = await enrich(mos);
            // Need a secondary map for component SKUs
            const compSkus = new Set<string>();
            mos.forEach(m => (m.lineItems || []).forEach((li: any) => li.sku && compSkus.add(li.sku.toString())));
            const compMap = await resolveSkuNames([...compSkus]);
            return apiSuccess(enriched.map((m, i) => {
                const missing = (mos[i].lineItems || []).filter((li: any) => !li.lotNumber).map((li: any) => ({
                    sku: li.sku, skuName: compMap.get(li.sku?.toString()) || 'Unknown', shortQty: li.recipeQty || 0,
                }));
                return { ...m, missingComponents: missing };
            }));
        }

        case 'operatorDiscrepancies': {
            const mos = await Manufacturing.find(dateMatch).select('_id label sku labor.user labor.createdAt').lean();
            return apiSuccess(computeOperatorDiscrepancies(mos));
        }

        case 'yieldVariance': {
            const mos = await Manufacturing.find({ ...dateMatch, status: 'Fulfilled' })
                .select('_id label sku status qty qtyDifference lineItems.qtyScrapped')
                .lean();
            const bad = mos.filter(m => {
                if (!m.qty || m.qty === 0) return false;
                return Math.abs(m.qtyDifference || 0) / m.qty * 100 > CFG.yieldVariancePct;
            });
            const enriched = await enrich(bad);
            return apiSuccess(enriched.map((m, i) => {
                const mo = bad[i];
                const actual = (mo.qty || 0) + (mo.qtyDifference || 0);
                let scrap = 0;
                (mo.lineItems || []).forEach((li: any) => { scrap += li.qtyScrapped || 0; });
                return { ...m, planned: mo.qty, actual, variancePct: ((mo.qtyDifference || 0) / (mo.qty || 1) * 100).toFixed(1), scrapQty: scrap };
            }));
        }

        case 'noValuation': {
            const mos = await Manufacturing.find({ ...dateMatch, status: 'Fulfilled', $or: [{ laborCost: 0 }, { laborCost: null }] })
                .select('_id label sku status qty qtyDifference laborCost totalCost labor createdAt')
                .lean();
            const bad = mos.filter(m => (m.labor || []).length > 0);
            return apiSuccess(await enrich(bad));
        }

        case 'reworkLoops': {
            const mos = await Manufacturing.find(dateMatch).select('_id label sku status lineItems.sku').lean();
            const rows: any[] = [];
            const compSkus = new Set<string>();
            mos.forEach(mo => {
                const skuCount = new Map<string, number>();
                (mo.lineItems || []).forEach((li: any) => { 
                    if (li.sku) {
                        skuCount.set(li.sku.toString(), (skuCount.get(li.sku.toString()) || 0) + 1);
                        compSkus.add(li.sku.toString());
                    }
                });
                const dupes = [...skuCount.entries()].filter(([, c]) => c > 1);
                if (dupes.length > 0) rows.push({ mo, dupes });
            });
            const compMap = await resolveSkuNames([...compSkus]);
            const enriched = await enrich(rows.map(r => r.mo));
            return apiSuccess(enriched.map((m, i) => ({
                ...m, duplicateSkus: rows[i].dupes.map(([id, c]: any) => ({ sku: id, skuName: compMap.get(id) || 'Unknown', occurrences: c }))
            })));
        }

        default:
            return apiError('Unknown KPI: ' + kpi, 400);
    }
}
