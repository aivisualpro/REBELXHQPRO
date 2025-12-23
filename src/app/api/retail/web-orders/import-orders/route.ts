import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import WebOrder from '@/models/WebOrder';

export const maxDuration = 60; // Increase timeout for bulk imports

export async function POST(request: Request) {
    try {
        await dbConnect();
        const body = await request.json();
        const { data } = body;

        if (!Array.isArray(data) || data.length === 0) {
            return NextResponse.json({ error: 'No data provided' }, { status: 400 });
        }

        const errors: string[] = [];
        let successCount = 0;

        // Process in parallel with concurrency limit if needed, 
        // but for now Promise.all is fine for chunks of 500 (from page.tsx)
        const results = await Promise.all(data.map(async (row: any, index: number) => {
            try {
                if (!row._id) {
                    return { error: `Row ${index + 1}: Missing _id` };
                }

                // Explicit mapping based on user provided headers
                // _id, category, status, orderAmount, createdAt, tax, firstName, lastName, city, state, postcode, email
                
                const updateData: any = {
                    category: row.category,
                    status: row.status,
                    orderAmount: typeof row.orderAmount === 'string' 
                        ? parseFloat(row.orderAmount.replace(/[^0-9.-]+/g, '')) || 0 
                        : parseFloat(row.orderAmount) || 0,
                    tax: typeof row.tax === 'string' 
                        ? parseFloat(row.tax.replace(/[^0-9.-]+/g, '')) || 0 
                        : parseFloat(row.tax) || 0,
                    firstName: row.firstName,
                    lastName: row.lastName,
                    city: row.city,
                    state: row.state,
                    postcode: row.postcode,
                    email: row.email,
                    // Preserve existing lineItems if we are just updating header info? 
                    // The previous bulkWrite logic passed empty lineItems array, which might overwrite?
                    // But here we use $set, so it only touches specified fields.
                    // We DO NOT want to erase lineItems if we are just upserting header.
                };

                // Rigorous Date Parsing
                // Check all likely variations of the header
                const dateRaw = row.createdAt || row.createAt || row['Create At'] || row['Created At'] || row['Date'] || row['date'];
                
                if (dateRaw) {
                    const parsed = new Date(dateRaw);
                    if (!isNaN(parsed.getTime())) {
                        updateData.createdAt = parsed;
                    } else {
                         // Valid date string not found, try to parse MM/DD/YYYY manually if standard parse fails? 
                         // But usually new Date() handles it. 
                         // Just fallback to now? No, user wants error if possible or just use now but log it.
                         // For now, let's trust new Date() works for standard formats.
                         console.warn(`Invalid date format for row ${row._id}: ${dateRaw}`);
                    }
                }

                // Manually update updatedAt since we are turning off auto-timestamps for this op
                updateData.updatedAt = new Date();

                await WebOrder.findOneAndUpdate(
                    { _id: row._id },
                    { $set: updateData },
                    { 
                        upsert: true, 
                        new: true, 
                        setDefaultsOnInsert: true,
                        timestamps: false // CRITICAL: Prevent Mongoose from overriding createdAt with 'now'
                    }
                );
                
                return { success: true };

            } catch (err: any) {
                return { error: `Row ${index + 1}: ${err.message}` };
            }
        }));

        results.forEach(r => {
            if (r.error) errors.push(r.error);
            else successCount++;
        });

        return NextResponse.json({
            success: true,
            count: successCount,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error: any) {
        console.error('Web Order Import Error:', error);
        return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
}
