import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import AuditAdjustment from '@/models/AuditAdjustment';
import Sku from '@/models/Sku';
import User from '@/models/User';

export async function POST(request: Request) {
    try {
        await dbConnect();
        const body = await request.json();
        const { items } = body;

        if (!Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: 'No items provided' }, { status: 400 });
        }

        const adjustmentsToCreate = [];
        const errors = [];

        // Optimize: Bulk Lookups
        const skuIdentifiers = new Set<string>();
        const userIdentifiers = new Set<string>();

        items.forEach((row: any) => {
            if (row.sku) skuIdentifiers.add(row.sku);
            if (row.createdBy) userIdentifiers.add(row.createdBy);
        });

        // Fetch SKUs
        // We look for _id matches and Name matches
        const potentialSkuIds = Array.from(skuIdentifiers).filter(id => id.match(/^[0-9a-fA-F]{24}$/));
        const potentialSkuNames = Array.from(skuIdentifiers);
        
        const skus = await Sku.find({
            $or: [
                { _id: { $in: potentialSkuIds } },
                { name: { $in: potentialSkuNames } } // Case sensitive match for speed. If needed, we can do regex but slow.
            ]
        }).select('_id name').lean();

        // Create SKU Map: Key -> ID
        const skuMap = new Map<string, string>();
        skus.forEach((s: any) => {
            skuMap.set(s._id.toString(), s._id.toString());
            skuMap.set(s.name, s._id.toString());
            skuMap.set(s.name.toLowerCase(), s._id.toString()); // Soften case sensitivity support
        });


        // Fetch Users (Assuming relatively low user count, we can be broader or just match IDs/emails)
        // If system handles < 1000 users, fetching all is faster than complex $or queries for names
        const users = await User.find({}).select('_id email firstName lastName').lean();
        
        const userMap = new Map<string, string>();
        users.forEach((u: any) => {
            userMap.set(u._id.toString(), u._id.toString());
            userMap.set(u.email, u._id.toString());
            userMap.set(u.email.toLowerCase(), u._id.toString());
            const fullName = `${u.firstName} ${u.lastName}`;
            userMap.set(fullName, u._id.toString());
            userMap.set(fullName.toLowerCase(), u._id.toString());
        });

        for (const [index, row] of items.entries()) {
            try {
                // 1. Resolve SKU
                // Try Direct Map (ID or Name)
                let skuId = skuMap.get(row.sku) || skuMap.get(row.sku?.toLowerCase());

                if (!skuId) {
                    // Fallback to raw string if not found, as per request
                    skuId = row.sku;
                }

                // 2. Resolve User
                let userId = userMap.get(row.createdBy) || userMap.get(row.createdBy?.toLowerCase());

                if (!userId && row.createdBy) {
                     // Fallback to raw string if not found
                     userId = row.createdBy;
                }

                // 3. Construct Object
                const adjustment: any = {
                    sku: skuId,
                    lotNumber: row.lotNumber || '',
                    qty: parseFloat(row.qty),
                    reason: row.reason || '',
                    createdBy: userId
                };

                // Explicit _id check - Only use if valid ObjectId, otherwise let Mongo generate
                if (row._id && typeof row._id === 'string' && row._id.match(/^[0-9a-fA-F]{24}$/)) {
                    adjustment._id = row._id;
                }

                // Explicit createdAt
                if (row.createdAt) {
                    adjustment.createdAt = new Date(row.createdAt);
                }

                adjustmentsToCreate.push(adjustment);

            } catch (err: any) {
                errors.push(`Row ${index + 1}: ${err.message}`);
            }
        }

        if (adjustmentsToCreate.length > 0) {
            console.log(`Attempting to insert ${adjustmentsToCreate.length} records...`);
            
            try {
                // Using bulkWrite or insertMany. Since we might specify _id, we need to be careful with duplicates.
                // insertMany with ordered: false lets successful ones pass.
                const result = await AuditAdjustment.insertMany(adjustmentsToCreate, { ordered: false, rawResult: true });
                console.log(`Insert result: Accepted: ${result?.insertedCount}, Acknowledged: ${result?.acknowledged}`);
            } catch (e: any) {
                 console.error('Bulk Insert Error:', e);
                 // If it's a write error (partial success), we can still return success for some
                 if (e.writeErrors) {
                     console.log(`Errors occurred: ${e.writeErrors.length}`);
                     e.writeErrors.forEach((we: any) => console.log(`Write Error Index ${we.index}: ${we.errmsg}`));
                 }
            }
        }

        return NextResponse.json({
            success: true,
            count: adjustmentsToCreate.length,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error: any) {
        console.error('Import Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
