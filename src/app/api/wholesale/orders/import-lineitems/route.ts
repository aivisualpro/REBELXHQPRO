import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import SaleOrder from '@/models/SaleOrder';
import Sku from '@/models/Sku';

export const dynamic = 'force-dynamic';

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
        const body = await request.json();
        const { data } = body;

        const lineItemsData = Array.isArray(data) ? data : body.lineItems; // Fallback to old format

        if (!lineItemsData || !Array.isArray(lineItemsData)) {
            return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
        }

        // DEBUG: Log the first row to see actual headers
        if (lineItemsData.length > 0) {
            console.log('Import Line Items - First Row Keys:', Object.keys(lineItemsData[0]));
            console.log('Import Line Items - First Row Sample:', lineItemsData[0]);
        }

        // Fetch all SKUs for lookup (by _id/name and by legacyId)
        const skus = await Sku.find({}).select('_id name legacyId').lean();
        // Create lookup maps for SKUs
        const skuIdMap = new Map(skus.map((s: any) => [s._id.toString(), s._id]));
        const skuNameMap = new Map(skus.map((s: any) => [s.name?.toLowerCase(), s._id]));
        const skuLegacyIdMap = new Map(skus.filter((s: any) => s.legacyId).map((s: any) => [s.legacyId, s._id]));

        // Group rows by Order Reference (legacyId is now the primary lookup)
        const rowsByOrder = new Map<string, any[]>();
        const orderRefs = new Set<string>();

        for (const row of lineItemsData) {
            // orderNumber is the parent order reference (legacyId or label of the SaleOrder)
            // row.legacyId is the LINE ITEM's own legacyId, NOT the parent order ref
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

        // Fetch all related orders in one go (search by legacyId, label, and _id)
        const orderRefsArray = Array.from(orderRefs);
        console.log(`[import-lineitems] Looking up ${orderRefsArray.length} unique order references. First 5:`, orderRefsArray.slice(0, 5));
        
        const orders = await SaleOrder.find({
            $or: [
                { legacyId: { $in: orderRefsArray } },
                { label: { $in: orderRefsArray } },
                { _id: { $in: orderRefsArray.filter(r => r.match(/^[a-f\d]{24}$/i)) } } // Only valid ObjectIds
            ]
        });

        console.log(`[import-lineitems] Found ${orders.length} orders matching ${orderRefs.size} unique references`);

        const bulkOps = [];
        let addedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;

        for (const order of orders) {
            // Get rows matching this order (by legacyId, label, or _id)
            const matchingRows = [
                ...(rowsByOrder.get(order.legacyId) || []),
                ...(rowsByOrder.get(order.label) || []),
                ...(rowsByOrder.get(order._id.toString()) || [])
            ];
            
            // Deduplicate rows (in case same ref matched multiple fields)
            const seenRows = new Set();
            const uniqueRows = matchingRows.filter(row => {
                const key = JSON.stringify(row);
                if (seenRows.has(key)) return false;
                seenRows.add(key);
                return true;
            });

            if (uniqueRows.length === 0) continue;

            const currentLineItems = order.lineItems || [];
            
            // Create a map for existing line items to detect duplicates
            // Key: sku_lotNumber (or sku only if no lot number)
            const existingItemsMap = new Map<string, number>();
            currentLineItems.forEach((item: any, index: number) => {
                const key = `${item.sku?.toString() || ''}_${item.lotNumber || ''}`.toLowerCase();
                existingItemsMap.set(key, index);
            });

            // Process rows
            for (const row of uniqueRows) {
                // Resolve SKU - try legacyId first, then _id, then name
                const skuRef = row.sku || row.skuName || row.SKU || row['Item Name'];
                let skuId = null;
                if (skuRef) {
                    // Try legacyId lookup first (for imported SKUs)
                    if (skuLegacyIdMap.has(skuRef)) {
                        skuId = skuLegacyIdMap.get(skuRef);
                    } else if (skuIdMap.has(skuRef)) {
                        skuId = skuRef;
                    } else if (skuNameMap.has(skuRef?.toLowerCase())) {
                        skuId = skuNameMap.get(skuRef?.toLowerCase());
                    }
                }

                // Parse Qty and Price
                const qty = parseNumber(row.qtyShipped || row.Qty || row['Qty Shipped'] || row.Quantity || row.quantity);
                const price = parseNumber(row.price || row.Price || row['Unit Price'] || row['unit price'] || row['Sale Price'] || row['sale price'] || row.Rate || row.rate);
                const lotNumber = row.lotNumber || row['Lot Number'] || '';
                const lineItemLegacyId = row.legacyId || row.lineItemLegacyId || row.lineItemId || row['Line Item ID'] || row['Line Item Legacy ID'] || '';

                // Construct Item
                const newLineItem: any = {
                    orderNumber: order.label || order.legacyId, // Ensure consistency
                    sku: skuId, // Must be ObjectId - skip if not resolved
                    productDescription: row.productDescription || row['Product Description'] || row.description || '',
                    lotNumber: lotNumber,
                    qtyShipped: qty,
                    uom: row.uom || row.UOM || 'Each',
                    price: price,
                    total: parseNumber(row.total || row.Total || row.Amount) || (qty * price),
                    createdAt: row.createdAt ? new Date(row.createdAt) : new Date()
                };

                // Only include legacyId if provided (not for UI-created items)
                if (lineItemLegacyId) {
                    newLineItem.legacyId = lineItemLegacyId;
                }

                // Skip if SKU couldn't be resolved to an ObjectId
                if (!skuId) {
                    console.log('[import-lineitems] Skipping line item - SKU not found:', skuRef);
                    skippedCount++;
                    continue;
                }

                // Check for duplicate by legacyId first, then by SKU + lotNumber
                let existingIndex: number | undefined;
                const itemKey = `${skuId.toString()}_${lotNumber}`.toLowerCase();
                
                if (lineItemLegacyId) {
                    // First try matching by legacyId (most precise)
                    const legacyIdx = currentLineItems.findIndex((item: any) => item.legacyId === lineItemLegacyId);
                    if (legacyIdx >= 0) existingIndex = legacyIdx;
                }
                
                if (existingIndex === undefined) {
                    // Fallback to SKU + lotNumber dedup
                    existingIndex = existingItemsMap.get(itemKey);
                }

                if (existingIndex !== undefined && existingIndex >= 0) {
                    // Update existing line item
                    currentLineItems[existingIndex] = { 
                        ...currentLineItems[existingIndex], 
                        ...newLineItem,
                        _id: currentLineItems[existingIndex]._id // Preserve the original _id
                    };
                    updatedCount++;
                } else {
                    // Add new line item
                    currentLineItems.push(newLineItem);
                    // Update the map so subsequent rows with same key update this one
                    existingItemsMap.set(itemKey, currentLineItems.length - 1);
                    addedCount++;
                }
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

        return NextResponse.json({ 
            success: true, 
            count: addedCount + updatedCount,
            added: addedCount,
            updated: updatedCount,
            skipped: skippedCount
        });

    } catch (error: any) {
        console.error('Import LineItems Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
