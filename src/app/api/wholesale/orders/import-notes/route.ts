import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectToDatabase from '@/lib/mongoose';
import SaleOrder from '@/models/SaleOrder';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    console.log('[import-notes] API called');
    try {
        await connectToDatabase();
        const body = await req.json();
        console.log('[import-notes] Received', body.data?.length || 0, 'rows');
        const { data } = body;

        if (!Array.isArray(data)) {
            return NextResponse.json({ error: 'Invalid data format. Expected array of items.' }, { status: 400 });
        }

        if (data.length === 0) {
            return NextResponse.json({ message: 'No data to import', count: 0 });
        }

        // Debug: Log first row to see actual headers
        if (data.length > 0) {
            console.log('[import-notes] First row keys:', Object.keys(data[0]));
            console.log('[import-notes] First row sample:', JSON.stringify(data[0]));
        }

        // Normalize keys helper
        const normalizeKey = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, '');

        // Pre-process all rows and group by order
        const notesByOrder = new Map<string, any[]>();
        const orderRefs = new Set<string>();

        for (const rawItem of data) {
            const item: any = {};
            Object.keys(rawItem).forEach(k => {
                item[normalizeKey(k)] = rawItem[k];
            });

            // legacyId references the parent sale order's legacyId
            const legacyId = item.legacyid || item.orderid || item.ordernumber || item.order ||
                            rawItem.legacyId || rawItem.LegacyId || rawItem.orderNumber || rawItem.OrderNumber || rawItem['Order Number'];
            
            const note = item.note || item.notes || item.comment || item.text || item.message ||
                        rawItem.note || rawItem.Note || rawItem.Notes || rawItem.Comment;
            
            const createdBy = item.createdby || item.user || item.author ||
                             rawItem.createdBy || rawItem.CreatedBy || rawItem.Author;
            
            const createdAt = item.createdat || item.date || item.notedate ||
                             rawItem.createdAt || rawItem.CreatedAt || rawItem.Date;

            // Debug first item
            if (orderRefs.size === 0) {
                console.log('[import-notes] Parsed first row - legacyId:', legacyId, 'note:', note?.substring(0, 50));
            }

            if (!legacyId || !note) continue;

            const orderKey = String(legacyId).trim();
            orderRefs.add(orderKey);

            if (!notesByOrder.has(orderKey)) {
                notesByOrder.set(orderKey, []);
            }

            notesByOrder.get(orderKey)!.push({
                legacyId: orderKey,
                note: String(note).trim(),
                createdBy: createdBy || null,
                createdAt: createdAt ? new Date(createdAt) : new Date()
            });
        }

        console.log('[import-notes] Found', orderRefs.size, 'unique orders');

        if (orderRefs.size === 0) {
            return NextResponse.json({ message: 'No valid order references found', count: 0 });
        }

        // Fetch all orders in ONE query (search by legacyId, label, and _id)
        const allRefs = Array.from(orderRefs);
        const validObjectIds = allRefs.filter(id => mongoose.Types.ObjectId.isValid(id) && id.length === 24);
        
        const orConditions: any[] = [
            { label: { $in: allRefs } },
            { legacyId: { $in: allRefs } }
        ];
        if (validObjectIds.length > 0) {
            orConditions.push({ _id: { $in: validObjectIds } });
        }

        const orders = await SaleOrder.find({ $or: orConditions });

        console.log('[import-notes] Found', orders.length, 'matching orders in DB');

        // Build bulk operations
        const bulkOps = [];
        let count = 0;

        for (const order of orders) {
            // Get notes for this order (check label, _id, and legacyId)
            const newNotes = [
                ...(notesByOrder.get(order.label) || []),
                ...(notesByOrder.get(order._id.toString()) || []),
                ...(notesByOrder.get(order.legacyId) || [])
            ];

            if (newNotes.length === 0) continue;

            // Merge with existing notes
            const existingNotes = order.notes || [];

            for (const noteItem of newNotes) {
                existingNotes.push(noteItem);
                count++;
            }

            bulkOps.push({
                updateOne: {
                    filter: { _id: order._id },
                    update: { $set: { notes: existingNotes } }
                }
            });
        }

        if (bulkOps.length > 0) {
            console.log('[import-notes] Executing', bulkOps.length, 'bulk operations');
            await SaleOrder.bulkWrite(bulkOps);
        }

        console.log('[import-notes] Successfully processed', count, 'notes');
        return NextResponse.json({ 
            message: 'Import completed', 
            count: count
        });

    } catch (error: any) {
        console.error('[import-notes] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
