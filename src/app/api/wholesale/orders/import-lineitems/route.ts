import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import SaleOrder from '@/models/SaleOrder';
import Sku from '@/models/Sku';

const parseNumber = (val: any) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    // Remove currency symbols, commas, and whitespace
    const clean = String(val).replace(/[$,\s]/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
};

export async function POST(request: Request) {
    try {
        await dbConnect();
        const { data } = await request.json();

        if (!data || !Array.isArray(data)) {
            return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
        }

        // DEBUG: Log the first row to see actual headers
        if (data.length > 0) {
            console.log('Import Line Items - First Row Keys:', Object.keys(data[0]));
            console.log('Import Line Items - First Row Sample:', data[0]);
        }

        const skus = await Sku.find({}).select('_id name').lean();
        // Create lookup maps for SKUs
        const skuIdMap = new Map(skus.map((s: any) => [s._id.toString(), s._id]));
        const skuNameMap = new Map(skus.map((s: any) => [s.name?.toLowerCase(), s._id]));

        // Group rows by Order Reference (Label or ID)
        const rowsByOrder = new Map<string, any[]>();
        const orderRefs = new Set<string>();

        for (const row of data) {
            const ref = row.orderNumber || row.orderId || row.label || row['Order ID'] || row['Order Number'];
            if (!ref) continue;
            
            const refStr = String(ref);
            if (!rowsByOrder.has(refStr)) {
                rowsByOrder.set(refStr, []);
                orderRefs.add(refStr);
            }
            rowsByOrder.get(refStr)?.push(row);
        }

        if (orderRefs.size === 0) {
            console.log('No order references found in import data');
            return NextResponse.json({ success: true, count: 0 });
        }

        // Fetch all related orders in one go
        const orders = await SaleOrder.find({
            $or: [
                { label: { $in: Array.from(orderRefs) } },
                { _id: { $in: Array.from(orderRefs) } }
            ]
        });

        const bulkOps = [];
        let count = 0;

        for (const order of orders) {
            // Determine which key matched (Label or ID)
            // We check both because the ref could be either
            const matchingRows = [
                ...(rowsByOrder.get(order.label) || []),
                ...(rowsByOrder.get(order._id.toString()) || [])
            ];
            
            // Deduplicate rows if same ref used for both label and id (unlikely but safe)
            const uniqueRows = Array.from(new Set(matchingRows));

            if (uniqueRows.length === 0) continue;

            const currentLineItems = order.lineItems || [];
            
            // Process rows
            for (const row of uniqueRows) {
                // Resolve SKU
                const skuNameOrId = row.sku || row.skuName || row.SKU || row['Item Name'];
                let skuId = null;
                if (skuNameOrId) {
                    if (skuIdMap.has(skuNameOrId)) skuId = skuNameOrId;
                    else if (skuNameMap.has(skuNameOrId?.toLowerCase())) skuId = skuNameMap.get(skuNameOrId?.toLowerCase());
                }

                // Parse Qty and Price
                const qty = parseNumber(row.qtyShipped || row.Qty || row['Qty Shipped'] || row.Quantity || row.quantity);
                const price = parseNumber(row.price || row.Price || row['Unit Price'] || row['unit price'] || row['Sale Price'] || row['sale price'] || row.Rate || row.rate);

                // Construct Item
                const newLineItem: any = {
                    orderNumber: order.label, // Ensure consistency
                    sku: skuId || skuNameOrId,
                    lotNumber: row.lotNumber || row['Lot Number'],
                    qtyShipped: qty,
                    uom: row.uom || row.UOM || 'Each',
                    price: price,
                    total: parseNumber(row.total || row.Total || row.Amount) || (qty * price),
                    createdAt: row.createdAt ? new Date(row.createdAt) : new Date()
                };
                
                if (row._id) newLineItem._id = row._id;

                // Update or Push
                const existingIndex = row._id 
                    ? currentLineItems.findIndex((li: any) => li._id && li._id.toString() === row._id)
                    : -1;

                if (existingIndex > -1) {
                    currentLineItems[existingIndex] = { ...currentLineItems[existingIndex], ...newLineItem };
                } else {
                    currentLineItems.push(newLineItem);
                }
                count++;
            }

            // Add to bulk operations
            bulkOps.push({
                updateOne: {
                    filter: { _id: order._id },
                    update: { $set: { lineItems: currentLineItems } }
                }
            });
        }

        if (bulkOps.length > 0) {
            await SaleOrder.bulkWrite(bulkOps);
        }

        return NextResponse.json({ success: true, count });

    } catch (error: any) {
        console.error('Import LineItems Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
