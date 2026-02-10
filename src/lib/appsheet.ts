import mongoose from 'mongoose';

export async function syncSkuToAppSheet(sku: any, action: 'Add' | 'Edit' | 'Delete' = 'Edit') {
    const appId = process.env.APPSHEET_APP_ID;
    const accessKey = process.env.APPSHEET_ACCESS_KEY;

    if (!appId || !accessKey) {
        console.error('AppSheet API credentials missing');
        return;
    }

    const skuObj = sku.toObject ? sku.toObject() : sku;

    const row: Record<string, any> = {
        'SKU': skuObj.legacyId || skuObj._id || '',
        'Product': skuObj.name || '',
        'Image': skuObj.image || '',
        'Category': skuObj.category || '',
        'Sub Category': skuObj.subCategory || '',
        'Material Type': skuObj.materialType || '',
        'UOM': skuObj.uom || '',
        'Sale Price': skuObj.salePrice || 0,
        'Order Up to': skuObj.orderUpto || 0,
        'Re-Order Point': skuObj.reOrderPoint || 0,
        'Kit Applied': skuObj.kitApplied ? 'Y' : 'N',
        'isLotApplied': skuObj.isLotApplied ? 'Y' : 'N',
    };

    const payload = {
        Action: action,
        Properties: {
            Locale: 'en-US',
            Timezone: 'Eastern Standard Time',
        },
        Rows: [row]
    };

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        const response = await fetch(`https://api.appsheet.com/api/v2/apps/${appId}/tables/SKUs/Action`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ApplicationAccessKey': accessKey,
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });
        clearTimeout(timeout);

        const result = await response.json();
        console.log(`AppSheet SKU ${action} Result:`, result);
        return result;
    } catch (error) {
        console.error('AppSheet SKU Sync Error:', error);
    }
}

export async function syncClientToAppSheet(clients: any | any[]) {
    const appId = process.env.APPSHEET_APP_ID;
    const accessKey = process.env.APPSHEET_ACCESS_KEY;

    if (!appId || !accessKey) {
        console.error('AppSheet API credentials missing');
        return;
    }

    const clientArray = Array.isArray(clients) ? clients : [clients];
    const rows = clientArray.map(client => {
        // Handle Mongoose document or plain object
        const clientObj = client.toObject ? client.toObject() : client;

        const phones = clientObj.phones || [];
        const emails = clientObj.emails || [];
        const addresses = clientObj.addresses || [];
        const lastNote = clientObj.notes && clientObj.notes.length > 0 
            ? clientObj.notes[clientObj.notes.length - 1].note 
            : '';
        
        const whatsAppPhone = phones.find((p: any) => p.isWhatsApp || p.label?.toLowerCase().includes('whatsapp'))?.value || '';

        // Handle Sales Person Name if it was populated, else use ID
        let salesPersonName = clientObj.salesPerson;
        if (typeof clientObj.salesPerson === 'object' && clientObj.salesPerson !== null) {
            salesPersonName = `${clientObj.salesPerson.firstName || ''} ${clientObj.salesPerson.lastName || ''}`.trim();
        }

        return {
            'Client_id': clientObj.legacyId || clientObj._id || '',
            'Name': clientObj.name || '',
            'Description': clientObj.description || '',
            'Sales Person': salesPersonName || '',
            'Contact Status': clientObj.contactStatus || '',
            'Contact Type': clientObj.contactType || '',
            'Company Type': clientObj.companyType || '',
            'Phone': phones[0]?.value || '',
            'Email': emails[0]?.value || '',
            'Address': addresses[0]?.street || '',
            'City': addresses[0]?.city || '',
            'State': addresses[0]?.state || '',
            'Postal Code': addresses[0]?.postalCode || '',
            'Website': clientObj.website || '',
            'Facebook Page': clientObj.facebookPage || '',
            'Industry': clientObj.industry || '',
            'Forecasted Amount': clientObj.forecastedAmount || 0,
            'Interaction Count': clientObj.interactionCount || 0,
            'Created At': clientObj.createdAt ? new Date(clientObj.createdAt).toISOString() : '',
            'Last Note': lastNote,
            'Projected Close Date': clientObj.projectedCloseDate ? new Date(clientObj.projectedCloseDate).toISOString() : '',
            'Name on Card': clientObj.billing?.nameOnCard || '',
            'CC Number': clientObj.billing?.ccNumber || '',
            'Expiration Date': clientObj.billing?.expirationDate || '',
            'Security Code': clientObj.billing?.securityCode || '',
            'Zip Code': clientObj.billing?.zipCode || '',
            'Default Shipping Terms': clientObj.defaultShippingTerms || '',
            'Default Payment Method': clientObj.defaultPaymentMethod || '',
            'Phone 2': phones[1]?.value || '',
            'Phone 3': phones[2]?.value || '',
            'Whats App': whatsAppPhone,
            'Email 2': emails[1]?.value || '',
            'Email 3': emails[2]?.value || '',
            'Address 2': addresses[1]?.street || '',
            'City 2': addresses[1]?.city || '',
            'State 2': addresses[1]?.state || '',
            'Postal Code 2': addresses[1]?.postalCode || '',
        };
    });

    const payload = {
        Action: 'Add',
        Properties: {
            Locale: 'en-US',
            Timezone: 'Eastern Standard Time',
        },
        Rows: rows
    };

    try {
        const response = await fetch(`https://api.appsheet.com/api/v2/apps/${appId}/tables/Clients/Action`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ApplicationAccessKey': accessKey,
            },
            body: JSON.stringify(payload),
        });

        const result = await response.json();
        console.log('AppSheet Sync Result:', result);
        return result;
    } catch (error) {
        console.error('AppSheet Sync Error:', error);
    }
}

export async function syncOrderToAppSheet(order: any) {
    const appId = process.env.APPSHEET_APP_ID;
    const accessKey = process.env.APPSHEET_ACCESS_KEY;

    if (!appId || !accessKey) {
        console.error('AppSheet API credentials missing');
        return;
    }

    // Map Order to "Orders" table
    const orderObj = order.toObject ? order.toObject() : order;
    
    // Use email for Sales Representative in AppSheet
    let salesRepEmail = '';
    if (typeof orderObj.salesRep === 'object' && orderObj.salesRep !== null) {
        salesRepEmail = orderObj.salesRep.email || '';
    } else if (typeof orderObj.salesRep === 'string') {
        salesRepEmail = orderObj.salesRep; // Fallback to ID/string if not populated
    }

    // Use legacyId as AppSheet key if exists (imported), otherwise use _id (new records)
    let clientIdForAppSheet = '';
    if (typeof orderObj.clientId === 'object' && orderObj.clientId !== null) {
        clientIdForAppSheet = orderObj.clientId.legacyId || orderObj.clientId._id || '';
    } else {
        clientIdForAppSheet = orderObj.clientId || '';
    }

    const orderRow = {
        'Order #': orderObj.legacyId || orderObj._id,
        'ClientID': clientIdForAppSheet,
        'TimeStamp': orderObj.createdAt ? new Date(orderObj.createdAt).toISOString() : '',
        'Sales Representative': salesRepEmail || '',
        'Discount': orderObj.discount || 0,
        'Payment Method': orderObj.paymentMethod || '',
        'Order Status': orderObj.orderStatus || '',
        '1000000': orderObj.label || '', 
        'Shipped Date': orderObj.shippedDate ? new Date(orderObj.shippedDate).toISOString() : '',
        'Shipping Method': orderObj.shippingMethod || '',
        'Tracking #': orderObj.trackingNumber || '',
        'Shipping Cost': orderObj.shippingCost || 0,
        'Tax%': orderObj.tax || 0,
        'Ship to Address': orderObj.shippingAddress || '',
        'City': orderObj.city || '',
        'State': orderObj.state || '',
        'Lock Prices': orderObj.lockPrice ? 'Y' : 'N'
    };

    const orderPayload = {
        Action: 'Add',
        Properties: { Locale: 'en-US', Timezone: 'Eastern Standard Time' },
        Rows: [orderRow]
    };

    // Map Line Items to "Order Details" table
    // Use legacyId as AppSheet key if exists (imported), otherwise use _id (new records)
    const detailRows = (orderObj.lineItems || []).map((item: any) => {
        let productIdForAppSheet = '';
        if (typeof item.sku === 'object' && item.sku !== null) {
            productIdForAppSheet = item.sku.legacyId || item.sku._id || '';
        } else {
            productIdForAppSheet = item.sku || '';
        }
        
        return {
            'RecordID': item._id,
            'Order #': orderObj.legacyId || orderObj._id,
            'ProductID': productIdForAppSheet,
            'Lot #': item.lotNumber || '',
            'Qty Shipped': item.qtyShipped || 0,
            'UOM': item.uom || '',
            'Price': item.price || 0,
            'Tracking ID': '', 
            'TimeStamp': item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString()
        };
    });

    const detailPayload = {
        Action: 'Add',
        Properties: { Locale: 'en-US', Timezone: 'Eastern Standard Time' },
        Rows: detailRows
    };

    // Helper function to fetch with timeout
    const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = 30000) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            return response;
        } finally {
            clearTimeout(timeout);
        }
    };

    try {
        // Run both API calls in PARALLEL for faster sync
        const promises: Promise<any>[] = [];
        
        // Order sync promise
        promises.push(
            fetchWithTimeout(
                `https://api.appsheet.com/api/v2/apps/${appId}/tables/Orders/Action`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'ApplicationAccessKey': accessKey },
                    body: JSON.stringify(orderPayload),
                }
            ).then(res => res.json()).then(result => {
                console.log('AppSheet Order Sync Result:', result);
                return result;
            })
        );

        // Order Details sync promise (only if there are line items)
        if (detailRows.length > 0) {
            promises.push(
                fetchWithTimeout(
                    `https://api.appsheet.com/api/v2/apps/${appId}/tables/Order Details/Action`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'ApplicationAccessKey': accessKey },
                        body: JSON.stringify(detailPayload),
                    }
                ).then(res => res.json()).then(result => {
                    console.log('AppSheet Order Details Sync Result:', result);
                    return result;
                })
            );
        }

        // Wait for all in parallel
        const results = await Promise.all(promises);
        return { orderResult: results[0], detailResult: results[1] || null };
    } catch (error) {
        console.error('AppSheet Order Sync Error:', error);
    }
}

export async function deleteOrderFromAppSheet(order: any) {
    const appId = process.env.APPSHEET_APP_ID;
    const accessKey = process.env.APPSHEET_ACCESS_KEY;

    if (!appId || !accessKey) {
        console.error('AppSheet API credentials missing');
        return;
    }

    const orderObj = order.toObject ? order.toObject() : order;
    const orderKey = orderObj.legacyId || orderObj._id?.toString() || '';

    if (!orderKey) {
        console.error('No order key found for AppSheet deletion');
        return;
    }

    // Helper function to fetch with timeout
    const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = 30000) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            return response;
        } finally {
            clearTimeout(timeout);
        }
    };

    try {
        const promises: Promise<any>[] = [];

        // Delete the Order row from AppSheet
        const orderPayload = {
            Action: 'Delete',
            Properties: { Locale: 'en-US', Timezone: 'Eastern Standard Time' },
            Rows: [{ 'Order #': orderKey }]
        };

        promises.push(
            fetchWithTimeout(
                `https://api.appsheet.com/api/v2/apps/${appId}/tables/Orders/Action`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'ApplicationAccessKey': accessKey },
                    body: JSON.stringify(orderPayload),
                }
            ).then(res => res.json()).then(result => {
                console.log('AppSheet Order Delete Result:', result);
                return result;
            })
        );

        // Delete all Order Detail rows from AppSheet
        const lineItems = orderObj.lineItems || [];
        if (lineItems.length > 0) {
            const detailRows = lineItems.map((item: any) => ({
                'RecordID': item._id?.toString() || item._id,
            }));

            const detailPayload = {
                Action: 'Delete',
                Properties: { Locale: 'en-US', Timezone: 'Eastern Standard Time' },
                Rows: detailRows
            };

            promises.push(
                fetchWithTimeout(
                    `https://api.appsheet.com/api/v2/apps/${appId}/tables/Order Details/Action`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'ApplicationAccessKey': accessKey },
                        body: JSON.stringify(detailPayload),
                    }
                ).then(res => res.json()).then(result => {
                    console.log('AppSheet Order Details Delete Result:', result);
                    return result;
                })
            );
        }

        const results = await Promise.all(promises);
        return { orderResult: results[0], detailResult: results[1] || null };
    } catch (error) {
        console.error('AppSheet Order Delete Error:', error);
    }
}

export async function syncPaymentToAppSheet(order: any, payment: any, action: 'Add' | 'Edit' | 'Delete' = 'Add') {
    const appId = process.env.APPSHEET_APP_ID;
    const accessKey = process.env.APPSHEET_ACCESS_KEY;

    if (!appId || !accessKey) {
        console.error('AppSheet API credentials missing');
        return;
    }

    // Use legacyId as Order # if exists (imported records), otherwise use _id (new records)
    // This must match the 'Order #' sent in syncOrderToAppSheet
    const orderIdentifier = order?.legacyId || order?._id?.toString() || '';

    const row: Record<string, any> = {
        'RecordID': payment.legacyId || payment._id?.toString() || '',
        'Order #': orderIdentifier,
        'Payment Date': payment.createdAt ? new Date(payment.createdAt).toLocaleDateString('en-US') : '',
        'Payment Amount': payment.paymentAmount || 0,
        'Create By': payment.createdBy || '',
    };

    const payload = {
        Action: action,
        Properties: {
            Locale: 'en-US',
            Timezone: 'Eastern Standard Time',
        },
        Rows: [row]
    };

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        const response = await fetch(`https://api.appsheet.com/api/v2/apps/${appId}/tables/Payments/Action`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ApplicationAccessKey': accessKey,
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });
        clearTimeout(timeout);

        const result = await response.json();
        console.log(`AppSheet Payment ${action} Result:`, result);
        return result;
    } catch (error) {
        console.error('AppSheet Payment Sync Error:', error);
    }
}

export async function syncOrderLineItemToAppSheet(order: any, lineItem: any, action: 'Add' | 'Edit' | 'Delete' = 'Add') {
    const appId = process.env.APPSHEET_APP_ID;
    const accessKey = process.env.APPSHEET_ACCESS_KEY;

    if (!appId || !accessKey) {
        console.error('AppSheet API credentials missing');
        return;
    }

    const orderObj = order.toObject ? order.toObject() : order;
    const orderIdentifier = orderObj.legacyId || orderObj._id?.toString() || '';

    // Resolve SKU to ProductID for AppSheet
    let productIdForAppSheet = '';
    if (typeof lineItem.sku === 'object' && lineItem.sku !== null) {
        productIdForAppSheet = lineItem.sku.legacyId || lineItem.sku._id?.toString() || '';
    } else {
        productIdForAppSheet = lineItem.sku?.toString() || '';
    }

    const row: Record<string, any> = {
        'RecordID': lineItem.legacyId || lineItem._id?.toString() || '',
        'Order #': orderIdentifier,
        'ProductID': productIdForAppSheet,
        'Lot #': lineItem.lotNumber || '',
        'Qty Shipped': lineItem.qtyShipped || 0,
        'UOM': lineItem.uom || '',
        'Price': lineItem.price || 0,
        'Tracking ID': '',
        'TimeStamp': lineItem.createdAt ? new Date(lineItem.createdAt).toISOString() : new Date().toISOString()
    };

    const payload = {
        Action: action,
        Properties: {
            Locale: 'en-US',
            Timezone: 'Eastern Standard Time',
        },
        Rows: [row]
    };

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        const response = await fetch(`https://api.appsheet.com/api/v2/apps/${appId}/tables/Order Details/Action`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ApplicationAccessKey': accessKey,
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });
        clearTimeout(timeout);

        const result = await response.json();
        console.log(`AppSheet Order Detail ${action} Result:`, result);

        // If Add fails because key already exists, retry with Edit
        if (action === 'Add' && result?.Errors) {
            console.log('Order Detail Add failed, retrying with Edit...');
            return syncOrderLineItemToAppSheet(order, lineItem, 'Edit');
        }

        return result;
    } catch (error) {
        console.error('AppSheet Order Detail Sync Error:', error);
    }
}

export async function syncManufacturingToAppSheet(
    order: any,
    action: 'Add' | 'Edit' | 'Delete' = 'Add'
) {
    const appId = process.env.APPSHEET_APP_ID;
    const accessKey = process.env.APPSHEET_ACCESS_KEY;

    if (!appId || !accessKey) {
        console.error('AppSheet API credentials missing');
        return;
    }

    const orderObj = order.toObject ? order.toObject() : order;

    // Resolve SKU ID: use legacyId if available (imported), otherwise _id
    let finishedProductId = '';
    if (typeof orderObj.sku === 'object' && orderObj.sku !== null) {
        finishedProductId = orderObj.sku.legacyId || orderObj.sku._id?.toString() || '';
    } else {
        finishedProductId = orderObj.sku?.toString() || '';
    }

    // Resolve createdBy email
    let createdByEmail = '';
    if (typeof orderObj.createdBy === 'object' && orderObj.createdBy !== null) {
        createdByEmail = orderObj.createdBy.email || '';
    } else if (typeof orderObj.createdBy === 'string') {
        createdByEmail = orderObj.createdBy;
    }

    // Resolve finishedBy email
    let finishedByEmail = '';
    if (typeof orderObj.finishedBy === 'object' && orderObj.finishedBy !== null) {
        finishedByEmail = orderObj.finishedBy.email || '';
    } else if (typeof orderObj.finishedBy === 'string') {
        finishedByEmail = orderObj.finishedBy;
    }

    // Resolve recipe ID
    let recipesId = '';
    if (typeof orderObj.recipesId === 'object' && orderObj.recipesId !== null) {
        recipesId = orderObj.recipesId._id?.toString() || '';
    } else {
        recipesId = orderObj.recipesId?.toString() || '';
    }

    // TimeStamp (createdAt) is the KEY column in AppSheet
    // For ADD: also send Key (_id) and WO # (label) 
    // For EDIT: only TimeStamp to identify the row + updatable fields
    const row: Record<string, any> = {
        'TimeStamp': orderObj.createdAt ? new Date(orderObj.createdAt).toISOString() : '',
        'Finished Product ID': finishedProductId,
        'RecipesID': recipesId,
        'WO Qty': orderObj.qty || 0,
        'UOM': orderObj.uom || '',
        'Output Difference +/-': orderObj.qtyDifference || 0,
        'Scheduled Start': orderObj.scheduledStart ? new Date(orderObj.scheduledStart).toISOString() : '',
        'Scheduled Finish': orderObj.scheduledFinish ? new Date(orderObj.scheduledFinish).toISOString() : '',
        'Priority': orderObj.priority || 'Normal',
        'Status': orderObj.status || 'Pending',
        'Create By': createdByEmail,
        'Finish By': finishedByEmail,
    };

    // WO # and Key are only sent on Add (not updatable in AppSheet)
    if (action === 'Add') {
        row['Key'] = orderObj._id?.toString() || '';
        row['WO #'] = orderObj.label || '';
    }

    const payload = {
        Action: action,
        Properties: {
            Locale: 'en-US',
            Timezone: 'Eastern Standard Time',
        },
        Rows: [row]
    };

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        const response = await fetch(
            `https://api.appsheet.com/api/v2/apps/${appId}/tables/Manufacturing/Action`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'ApplicationAccessKey': accessKey,
                },
                body: JSON.stringify(payload),
                signal: controller.signal,
            }
        );
        clearTimeout(timeout);

        const result = await response.json();
        console.log(`AppSheet Manufacturing ${action} Result:`, result);

        // If Add fails because key already exists, retry with Edit
        if (action === 'Add' && result?.Errors) {
            console.log('Add failed, retrying with Edit...');
            return syncManufacturingToAppSheet(order, 'Edit');
        }

        return result;
    } catch (error) {
        console.error('AppSheet Manufacturing Sync Error:', error);
    }
}

export async function deleteManufacturingFromAppSheet(order: any) {
    const appId = process.env.APPSHEET_APP_ID;
    const accessKey = process.env.APPSHEET_ACCESS_KEY;

    if (!appId || !accessKey) {
        console.error('AppSheet API credentials missing');
        return;
    }

    const orderObj = order.toObject ? order.toObject() : order;

    // Match by TimeStamp (createdAt) which is the key in AppSheet
    const row: Record<string, any> = {
        'TimeStamp': orderObj.createdAt ? new Date(orderObj.createdAt).toISOString() : '',
    };

    const payload = {
        Action: 'Delete',
        Properties: {
            Locale: 'en-US',
            Timezone: 'Eastern Standard Time',
        },
        Rows: [row]
    };

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        const response = await fetch(
            `https://api.appsheet.com/api/v2/apps/${appId}/tables/Manufacturing/Action`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'ApplicationAccessKey': accessKey,
                },
                body: JSON.stringify(payload),
                signal: controller.signal,
            }
        );
        clearTimeout(timeout);

        const result = await response.json();
        console.log('AppSheet Manufacturing Delete Result:', result);
        return result;
    } catch (error) {
        console.error('AppSheet Manufacturing Delete Error:', error);
    }
}

export async function syncManufacturingLineItemsToAppSheet(
    parentOrder: any,
    lineItems: any[],
    action: 'Add' | 'Edit' | 'Delete' = 'Add'
) {
    const appId = process.env.APPSHEET_APP_ID;
    const accessKey = process.env.APPSHEET_ACCESS_KEY;

    if (!appId || !accessKey) {
        console.error('AppSheet API credentials missing');
        return;
    }

    if (!lineItems || lineItems.length === 0) return;

    const parentObj = parentOrder.toObject ? parentOrder.toObject() : parentOrder;
    const parentCreatedAt = parentObj.createdAt ? new Date(parentObj.createdAt).toISOString() : '';
    const parentId = parentObj._id?.toString() || '';

    // Bulk lookup SKUs to resolve legacyId for Raw Material
    const skuIds = new Set<string>();
    lineItems.forEach((item: any) => {
        const skuId = typeof item.sku === 'object' && item.sku !== null
            ? (item.sku._id?.toString() || '')
            : (item.sku?.toString() || '');
        if (skuId) skuIds.add(skuId);
    });

    // Build a map of skuId -> legacyId
    const skuLegacyMap = new Map<string, string>();
    if (skuIds.size > 0) {
        try {
            const db = mongoose.connection.db;
            if (db) {
                const objectIds = [...skuIds]
                    .filter(id => mongoose.Types.ObjectId.isValid(id))
                    .map(id => new mongoose.Types.ObjectId(id));
                const skuDocs = await db.collection('skus').find({
                    $or: [
                        { _id: { $in: [...skuIds] } },
                        { _id: { $in: objectIds } },
                        { legacyId: { $in: [...skuIds] } }
                    ]
                } as any, { projection: { _id: 1, legacyId: 1 } }).toArray();
                skuDocs.forEach((s: any) => {
                    const id = String(s._id);
                    if (s.legacyId) {
                        skuLegacyMap.set(id, s.legacyId);
                    }
                    // Also map by legacyId in case sku reference is stored as legacyId
                    if (s.legacyId) {
                        skuLegacyMap.set(s.legacyId, s.legacyId);
                    }
                });
            }
        } catch (e) {
            console.error('Failed to lookup SKU legacyIds for line items:', e);
        }
    }

    const rows = lineItems.map((item: any) => {
        // Resolve SKU: use legacyId if available, otherwise _id
        let skuRef = '';
        if (typeof item.sku === 'object' && item.sku !== null) {
            skuRef = item.sku._id?.toString() || '';
        } else {
            skuRef = item.sku?.toString() || '';
        }
        const rawMaterialId = skuLegacyMap.get(skuRef) || skuRef;

        return {
            'RecordID': item._id?.toString() || '',
            'WO #': parentCreatedAt,
            'Lot #': item.lotNumber || '',
            'RecipesID': item.recipeId?.toString() || '',
            'Raw Material': rawMaterialId,
            'UOM': item.uom || '',
            'Qty': item.recipeQty || 0,
            'SA': item.sa || 0,
            'Qty Extra Consumed': item.qtyExtra || 0,
            'Qty Scrapped': item.qtyScrapped || 0,
            'TimeStamp': item.createdAt ? new Date(item.createdAt).toISOString() : '',
        };
    });

    const payload = {
        Action: action,
        Properties: {
            Locale: 'en-US',
            Timezone: 'Eastern Standard Time',
        },
        Rows: rows
    };

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        const response = await fetch(
            `https://api.appsheet.com/api/v2/apps/${appId}/tables/Manufacturing LineItems/Action`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'ApplicationAccessKey': accessKey,
                },
                body: JSON.stringify(payload),
                signal: controller.signal,
            }
        );
        clearTimeout(timeout);

        const result = await response.json();
        console.log(`AppSheet Manufacturing LineItems ${action} Result:`, result);

        // If Add fails because key already exists, retry with Edit
        if (action === 'Add' && result?.Errors) {
            console.log('LineItems Add failed, retrying with Edit...');
            return syncManufacturingLineItemsToAppSheet(parentOrder, lineItems, 'Edit');
        }

        return result;
    } catch (error) {
        console.error('AppSheet Manufacturing LineItems Sync Error:', error);
    }
}

export async function deleteManufacturingLineItemsFromAppSheet(lineItemIds: string[]) {
    const appId = process.env.APPSHEET_APP_ID;
    const accessKey = process.env.APPSHEET_ACCESS_KEY;

    if (!appId || !accessKey) {
        console.error('AppSheet API credentials missing');
        return;
    }

    if (!lineItemIds || lineItemIds.length === 0) return;

    const rows = lineItemIds.map(id => ({
        'RecordID': id,
    }));

    const payload = {
        Action: 'Delete',
        Properties: {
            Locale: 'en-US',
            Timezone: 'Eastern Standard Time',
        },
        Rows: rows
    };

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        const response = await fetch(
            `https://api.appsheet.com/api/v2/apps/${appId}/tables/Manufacturing LineItems/Action`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'ApplicationAccessKey': accessKey,
                },
                body: JSON.stringify(payload),
                signal: controller.signal,
            }
        );
        clearTimeout(timeout);

        const result = await response.json();
        console.log('AppSheet Manufacturing LineItems Delete Result:', result);
        return result;
    } catch (error) {
        console.error('AppSheet Manufacturing LineItems Delete Error:', error);
    }
}

// ═══════════════════════════════════════════════
// Purchase Order → AppSheet Sync
// ═══════════════════════════════════════════════

export async function syncPurchaseOrderToAppSheet(order: any, action: 'Add' | 'Edit' | 'Delete' = 'Add') {
    const appId = process.env.APPSHEET_APP_ID;
    const accessKey = process.env.APPSHEET_ACCESS_KEY;

    if (!appId || !accessKey) {
        console.error('AppSheet API credentials missing');
        return;
    }

    const orderObj = order.toObject ? order.toObject() : order;

    // Resolve vendor name
    let vendorName = '';
    if (typeof orderObj.vendor === 'object' && orderObj.vendor !== null) {
        vendorName = orderObj.vendor.name || orderObj.vendor.legacyId || orderObj.vendor._id?.toString() || '';
    } else {
        vendorName = orderObj.vendor?.toString() || '';
    }

    // Resolve createdBy email
    let createdByEmail = '';
    if (typeof orderObj.createdBy === 'object' && orderObj.createdBy !== null) {
        createdByEmail = orderObj.createdBy.email || `${orderObj.createdBy.firstName || ''} ${orderObj.createdBy.lastName || ''}`.trim() || '';
    } else if (typeof orderObj.createdBy === 'string') {
        createdByEmail = orderObj.createdBy;
    }

    const orderRow: Record<string, any> = {
        'PO #': orderObj.legacyId || orderObj._id?.toString() || '',
        '10000': orderObj.label || '',
        'Vendor': vendorName,
        'Payment Terms': orderObj.paymentTerms || '',
        'Created By': createdByEmail,
        'Status': orderObj.status || '',
        'Date Scheduled': orderObj.scheduledDelivery ? new Date(orderObj.scheduledDelivery).toISOString() : '',
        'Received Date': orderObj.receivedDate ? new Date(orderObj.receivedDate).toISOString() : '',
        'TimeStamp': orderObj.createdAt ? new Date(orderObj.createdAt).toISOString() : '',
    };

    const orderPayload = {
        Action: action,
        Properties: { Locale: 'en-US', Timezone: 'Eastern Standard Time' },
        Rows: [orderRow]
    };

    // Map Line Items to "PO lineitems" table
    const detailRows = (orderObj.lineItems || []).map((item: any) => {
        let productId = '';
        if (typeof item.sku === 'object' && item.sku !== null) {
            productId = item.sku.legacyId || item.sku._id?.toString() || '';
        } else {
            productId = item.sku?.toString() || '';
        }

        return {
            'Record ID': item.legacyId || item._id?.toString() || '',
            'OldPO #': item.poNumber || orderObj.legacyId || '',
            'Product Id': productId,
            'Lot #': item.lotNumber || '',
            'Qty': item.qtyOrdered || 0,
            'Qty Received': item.qtyReceived || 0,
            'UOM': item.uom || '',
            'Cost': item.cost || 0,
            'Amount': item.amount || 0,
            'TimeStamp': item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
        };
    });

    const detailPayload = {
        Action: action,
        Properties: { Locale: 'en-US', Timezone: 'Eastern Standard Time' },
        Rows: detailRows
    };

    // Helper function to fetch with timeout
    const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = 30000) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            return response;
        } finally {
            clearTimeout(timeout);
        }
    };

    try {
        // Run both API calls in PARALLEL for faster sync
        const promises: Promise<any>[] = [];

        // PO sync promise
        promises.push(
            fetchWithTimeout(
                `https://api.appsheet.com/api/v2/apps/${appId}/tables/PO/Action`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'ApplicationAccessKey': accessKey },
                    body: JSON.stringify(orderPayload),
                }
            ).then(res => res.json()).then(result => {
                console.log(`AppSheet PO ${action} Result:`, result);
                // If Add fails because key already exists, retry with Edit
                if (action === 'Add' && result?.Errors) {
                    console.log('PO Add failed, retrying with Edit...');
                    const editPayload = { ...orderPayload, Action: 'Edit' };
                    return fetchWithTimeout(
                        `https://api.appsheet.com/api/v2/apps/${appId}/tables/PO/Action`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'ApplicationAccessKey': accessKey },
                            body: JSON.stringify(editPayload),
                        }
                    ).then(r => r.json());
                }
                return result;
            })
        );

        // PO Line Items sync promise (only if there are line items)
        if (detailRows.length > 0) {
            promises.push(
                fetchWithTimeout(
                    `https://api.appsheet.com/api/v2/apps/${appId}/tables/PO lineitems/Action`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'ApplicationAccessKey': accessKey },
                        body: JSON.stringify(detailPayload),
                    }
                ).then(res => res.json()).then(result => {
                    console.log(`AppSheet PO LineItems ${action} Result:`, result);
                    // If Add fails, retry with Edit
                    if (action === 'Add' && result?.Errors) {
                        console.log('PO LineItems Add failed, retrying with Edit...');
                        const editPayload = { ...detailPayload, Action: 'Edit' };
                        return fetchWithTimeout(
                            `https://api.appsheet.com/api/v2/apps/${appId}/tables/PO lineitems/Action`,
                            {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'ApplicationAccessKey': accessKey },
                                body: JSON.stringify(editPayload),
                            }
                        ).then(r => r.json());
                    }
                    return result;
                })
            );
        }

        // Wait for all in parallel
        const results = await Promise.all(promises);
        return { orderResult: results[0], detailResult: results[1] || null };
    } catch (error) {
        console.error('AppSheet PO Sync Error:', error);
    }
}

export async function deletePurchaseOrderFromAppSheet(order: any) {
    const appId = process.env.APPSHEET_APP_ID;
    const accessKey = process.env.APPSHEET_ACCESS_KEY;

    if (!appId || !accessKey) {
        console.error('AppSheet API credentials missing');
        return;
    }

    const orderObj = order.toObject ? order.toObject() : order;
    const orderKey = orderObj.legacyId || orderObj._id?.toString() || '';

    if (!orderKey) {
        console.error('No PO key found for AppSheet deletion');
        return;
    }

    const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = 30000) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            return response;
        } finally {
            clearTimeout(timeout);
        }
    };

    try {
        const promises: Promise<any>[] = [];

        // Delete the PO row
        const orderPayload = {
            Action: 'Delete',
            Properties: { Locale: 'en-US', Timezone: 'Eastern Standard Time' },
            Rows: [{ 'PO #': orderKey }]
        };

        promises.push(
            fetchWithTimeout(
                `https://api.appsheet.com/api/v2/apps/${appId}/tables/PO/Action`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'ApplicationAccessKey': accessKey },
                    body: JSON.stringify(orderPayload),
                }
            ).then(res => res.json()).then(result => {
                console.log('AppSheet PO Delete Result:', result);
                return result;
            })
        );

        // Delete all PO Line Item rows
        const lineItems = orderObj.lineItems || [];
        if (lineItems.length > 0) {
            const detailRows = lineItems.map((item: any) => ({
                'Record ID': item.legacyId || item._id?.toString() || '',
            }));

            const detailPayload = {
                Action: 'Delete',
                Properties: { Locale: 'en-US', Timezone: 'Eastern Standard Time' },
                Rows: detailRows
            };

            promises.push(
                fetchWithTimeout(
                    `https://api.appsheet.com/api/v2/apps/${appId}/tables/PO lineitems/Action`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'ApplicationAccessKey': accessKey },
                        body: JSON.stringify(detailPayload),
                    }
                ).then(res => res.json()).then(result => {
                    console.log('AppSheet PO LineItems Delete Result:', result);
                    return result;
                })
            );
        }

        const results = await Promise.all(promises);
        return { orderResult: results[0], detailResult: results[1] || null };
    } catch (error) {
        console.error('AppSheet PO Delete Error:', error);
    }
}

export async function syncPOLineItemToAppSheet(order: any, lineItem: any, action: 'Add' | 'Edit' | 'Delete' = 'Add') {
    const appId = process.env.APPSHEET_APP_ID;
    const accessKey = process.env.APPSHEET_ACCESS_KEY;

    if (!appId || !accessKey) {
        console.error('AppSheet API credentials missing');
        return;
    }

    const orderObj = order.toObject ? order.toObject() : order;

    // Resolve SKU to ProductID
    let productId = '';
    if (typeof lineItem.sku === 'object' && lineItem.sku !== null) {
        productId = lineItem.sku.legacyId || lineItem.sku._id?.toString() || '';
    } else {
        productId = lineItem.sku?.toString() || '';
    }

    const row: Record<string, any> = {
        'Record ID': lineItem.legacyId || lineItem._id?.toString() || '',
        'OldPO #': lineItem.poNumber || orderObj.legacyId || '',
        'Product Id': productId,
        'Lot #': lineItem.lotNumber || '',
        'Qty': lineItem.qtyOrdered || 0,
        'Qty Received': lineItem.qtyReceived || 0,
        'UOM': lineItem.uom || '',
        'Cost': lineItem.cost || 0,
        'Amount': lineItem.amount || 0,
        'TimeStamp': lineItem.createdAt ? new Date(lineItem.createdAt).toISOString() : new Date().toISOString(),
    };

    const payload = {
        Action: action,
        Properties: { Locale: 'en-US', Timezone: 'Eastern Standard Time' },
        Rows: [row]
    };

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        const response = await fetch(`https://api.appsheet.com/api/v2/apps/${appId}/tables/PO lineitems/Action`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ApplicationAccessKey': accessKey,
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });
        clearTimeout(timeout);

        const result = await response.json();
        console.log(`AppSheet PO LineItem ${action} Result:`, result);

        // If Add fails because key already exists, retry with Edit
        if (action === 'Add' && result?.Errors) {
            console.log('PO LineItem Add failed, retrying with Edit...');
            return syncPOLineItemToAppSheet(order, lineItem, 'Edit');
        }

        return result;
    } catch (error) {
        console.error('AppSheet PO LineItem Sync Error:', error);
    }
}
