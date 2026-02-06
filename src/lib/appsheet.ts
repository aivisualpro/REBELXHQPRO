import mongoose from 'mongoose';

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
            'Client_id': clientObj._id || '',
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
    
    let salesRepName = orderObj.salesRep;
    if (typeof orderObj.salesRep === 'object' && orderObj.salesRep !== null) {
        salesRepName = `${orderObj.salesRep.firstName || ''} ${orderObj.salesRep.lastName || ''}`.trim();
    }

    // Use legacyId for ClientID if client was imported, otherwise use ObjectId
    let clientIdForAppSheet = '';
    if (typeof orderObj.clientId === 'object' && orderObj.clientId !== null) {
        clientIdForAppSheet = orderObj.clientId.legacyId || orderObj.clientId._id || '';
    } else {
        clientIdForAppSheet = orderObj.clientId || '';
    }

    const orderRow = {
        'Order #': orderObj._id,
        'ClientID': clientIdForAppSheet,
        'TimeStamp': orderObj.createdAt ? new Date(orderObj.createdAt).toISOString() : '',
        'Sales Representative': salesRepName || '',
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
    // Use legacyId for ProductID if SKU was imported, otherwise use ObjectId
    const detailRows = (orderObj.lineItems || []).map((item: any) => {
        let productIdForAppSheet = '';
        if (typeof item.sku === 'object' && item.sku !== null) {
            productIdForAppSheet = item.sku.legacyId || item.sku._id || '';
        } else {
            productIdForAppSheet = item.sku || '';
        }
        
        return {
            'RecordID': item._id,
            'Order #': orderObj._id,
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

    try {
        // Sync Order
        const orderRes = await fetch(`https://api.appsheet.com/api/v2/apps/${appId}/tables/Orders/Action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'ApplicationAccessKey': accessKey },
            body: JSON.stringify(orderPayload),
        });
        const orderResult = await orderRes.json();
        console.log('AppSheet Order Sync Result:', orderResult);

        // Sync Details
        if (detailRows.length > 0) {
            const detailRes = await fetch(`https://api.appsheet.com/api/v2/apps/${appId}/tables/Order Details/Action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'ApplicationAccessKey': accessKey },
                body: JSON.stringify(detailPayload),
            });
            const detailResult = await detailRes.json();
            console.log('AppSheet Order Details Sync Result:', detailResult);
        }

        return { orderResult, detailResult: detailRows.length > 0 ? true : false };
    } catch (error) {
        console.error('AppSheet Order Sync Error:', error);
    }
}
