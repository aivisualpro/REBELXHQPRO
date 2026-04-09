import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import WebProduct from '@/models/WebProduct';
import WebOrder from '@/models/WebOrder';

export const dynamic = 'force-dynamic';

function transformShopifyProduct(p: any, siteName: string) {
    const webProductId = `WC-${siteName}-${p.id}`; // using WC- prefix internally for consistency 
    
    return {
        _id: webProductId,
        name: p.title,
        image: p.images?.[0]?.src || p.image?.src || '',
        website: siteName,
        updatedAt: new Date(),
        webId: p.id,
        slug: p.handle,
        permalink: p.handle, 
        dateCreated: p.created_at ? new Date(p.created_at) : null,
        dateModified: p.updated_at ? new Date(p.updated_at) : null,
        type: p.variants?.length > 1 ? 'variable' : 'simple',
        status: p.status === 'active' ? 'publish' : 'draft',
        description: p.body_html,
        sku_code: p.variants?.[0]?.sku || '',
        price: parseFloat(p.variants?.[0]?.price) || 0,
        regularPrice: parseFloat(p.variants?.[0]?.compare_at_price) || parseFloat(p.variants?.[0]?.price) || 0,
        salePrice: parseFloat(p.variants?.[0]?.price) || 0,
        tags: p.tags ? p.tags.split(',').map((t: string) => t.trim()) : [],
        webImages: p.images?.map((img: any) => ({
            id: img.id,
            src: img.src,
            dateCreated: img.created_at ? new Date(img.created_at) : null,
            dateModified: img.updated_at ? new Date(img.updated_at) : null
        })),
        // Simplistic mapping for variants
        variations: p.variants?.map((v: any) => ({
            _id: v.id?.toString(),
            id: v.id,
            name: v.title,
            website: siteName,
            sku: v.sku,
            price: parseFloat(v.price) || 0,
            regularPrice: parseFloat(v.compare_at_price) || parseFloat(v.price) || 0,
            stockQuantity: v.inventory_quantity,
        })),
        metaData: [],
    };
}

function transformShopifyOrder(order: any, siteName: string) {
    const orderId = `WC-${siteName}-${order.id}`;

    const lineItems = (order.line_items || []).map((item: any) => ({
        id: item.id,
        name: item.title,
        productId: item.product_id,
        variationId: item.variant_id,
        quantity: item.quantity,
        subtotal: parseFloat(item.price) * item.quantity || 0,
        total: parseFloat(item.price) * item.quantity || 0,
        sku: item.sku,
        price: parseFloat(item.price),
    }));

    return {
        _id: orderId,
        webId: order.id,
        number: order.name, 
        orderKey: order.token,
        status: order.financial_status === 'paid' ? 'processing' : 'pending',
        currency: order.currency,
        dateCreated: order.created_at ? new Date(order.created_at) : null,
        dateModified: order.updated_at ? new Date(order.updated_at) : null,
        discountTotal: parseFloat(order.total_discounts) || 0,
        shippingTotal: parseFloat(order.total_shipping_price_set?.shop_money?.amount || 0),
        total: parseFloat(order.total_price) || 0,
        totalTax: parseFloat(order.total_tax) || 0,
        customerId: order.customer?.id,
        customerIpAddress: order.browser_ip,
        customerNote: order.note,
        billing: {
            firstName: order.billing_address?.first_name,
            lastName: order.billing_address?.last_name,
            company: order.billing_address?.company,
            address1: order.billing_address?.address1,
            address2: order.billing_address?.address2,
            city: order.billing_address?.city,
            state: order.billing_address?.province,
            postcode: order.billing_address?.zip,
            country: order.billing_address?.country,
            email: order.email,
            phone: order.billing_address?.phone
        },
        shipping: {
            firstName: order.shipping_address?.first_name,
            lastName: order.shipping_address?.last_name,
            company: order.shipping_address?.company,
            address1: order.shipping_address?.address1,
            address2: order.shipping_address?.address2,
            city: order.shipping_address?.city,
            state: order.shipping_address?.province,
            postcode: order.shipping_address?.zip,
            country: order.shipping_address?.country
        },
        paymentMethodTitle: order.payment_gateway_names?.[0],
        lineItems,
        website: siteName,
        updatedAt: new Date()
    };
}

export async function POST(req: NextRequest) {
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);
        const site = searchParams.get('site');
        
        if (!site) {
            return NextResponse.json({ error: 'Missing site parameter. Setup your webhook url as /api/webhooks/shopify?site=YOUR_SITE_NAME' }, { status: 400 });
        }

        const topic = req.headers.get('x-shopify-topic') || '';
        const rawBodyText = await req.text();

        let body;
        try {
            body = JSON.parse(rawBodyText);
        } catch (e) {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }

        if (topic.includes('products/')) {
            if (topic === 'products/delete') {
                 // optionally handle deletion here if needed
                return NextResponse.json({ success: true, message: 'skipped delete' });
            }

            const transformedData = transformShopifyProduct(body, site);
            
            await WebProduct.findOneAndUpdate(
                { _id: transformedData._id },
                { $set: transformedData },
                { upsert: true }
            );

        } else if (topic.includes('orders/')) {
            if (topic === 'orders/delete') {
                 // optionally handle deletion here if needed
                return NextResponse.json({ success: true, message: 'skipped delete' });
            }

            const transformedData = transformShopifyOrder(body, site);
            
            const existingOrder = await WebOrder.findById(transformedData._id).select('lineItems').lean();
            
            if (existingOrder?.lineItems) {
                const existingItemMap = new Map((existingOrder.lineItems as any[]).map(li => [li.id, li]));
                
                transformedData.lineItems = transformedData.lineItems.map((newItem: any) => {
                    const existingItem = existingItemMap.get(newItem.id) as any;
                    if (existingItem) {
                        return {
                            ...newItem,
                            lotNumber: existingItem.lotNumber || newItem.lotNumber,
                            cost: existingItem.cost || newItem.cost,
                            linkedSkuId: existingItem.linkedSkuId || newItem.linkedSkuId,
                            linkedSkus: (existingItem.linkedSkus && existingItem.linkedSkus.length > 0)
                                        ? existingItem.linkedSkus
                                        : newItem.linkedSkus || [],
                            webProductId: existingItem.webProductId || newItem.webProductId,
                            image: existingItem.image || newItem.image
                        };
                    }
                    return newItem;
                });
            }

            await WebOrder.findOneAndUpdate(
                { _id: transformedData._id },
                { $set: transformedData },
                { upsert: true }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Shopify Webhook Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
