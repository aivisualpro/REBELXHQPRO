import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import dbConnect from '@/lib/mongoose';
import WebProduct from '@/models/WebProduct';
import WebOrder from '@/models/WebOrder';

export const dynamic = 'force-dynamic';

function transformProduct(p: any, siteName: string) {
    const webProductId = `WC-${siteName}-${p.id}`;
    
    return {
        _id: webProductId,
        name: p.name,
        image: p.images?.[0]?.src || '',
        website: siteName,
        updatedAt: new Date(),
        webId: p.id,
        slug: p.slug,
        permalink: p.permalink,
        dateCreated: p.date_created ? new Date(p.date_created) : null,
        dateModified: p.date_modified ? new Date(p.date_modified) : null,
        type: p.type,
        status: p.status,
        featured: p.featured,
        catalogVisibility: p.catalog_visibility,
        description: p.description,
        shortDescription: p.short_description,
        sku_code: p.sku,
        price: parseFloat(p.price) || 0,
        regularPrice: parseFloat(p.regular_price) || 0,
        salePrice: parseFloat(p.sale_price) || 0,
        dateOnSaleFrom: p.date_on_sale_from ? new Date(p.date_on_sale_from) : null,
        dateOnSaleTo: p.date_on_sale_to ? new Date(p.date_on_sale_to) : null,
        onSale: p.on_sale,
        purchasable: p.purchasable,
        totalSales: p.total_sales,
        virtual: p.virtual,
        downloadable: p.downloadable,
        taxStatus: p.tax_status,
        taxClass: p.tax_class,
        manageStock: p.manage_stock,
        stockQuantity: p.stock_quantity,
        stockStatus: p.stock_status,
        backorders: p.backorders,
        lowStockAmount: p.low_stock_amount,
        soldIndividually: p.sold_individually,
        weight: p.weight,
        dimensions: p.dimensions,
        shippingRequired: p.shipping_required,
        shippingTaxable: p.shipping_taxable,
        shippingClass: p.shipping_class,
        reviewsAllowed: p.reviews_allowed,
        averageRating: p.average_rating,
        ratingCount: p.rating_count,
        upsellIds: p.upsell_ids,
        crossSellIds: p.cross_sell_ids,
        parentId: p.parent_id,
        tags: p.tags,
        webCategories: p.categories?.map((c: any) => ({
            id: c.id,
            name: c.name,
            slug: c.slug
        })),
        webImages: p.images?.map((img: any) => ({
            id: img.id,
            src: img.src,
            name: img.name,
            alt: img.alt,
            dateCreated: img.date_created ? new Date(img.date_created) : null,
            dateModified: img.date_modified ? new Date(img.date_modified) : null
        })),
        webAttributes: p.attributes,
        metaData: p.meta_data,
    };
}

function transformOrder(order: any, siteName: string) {
    const orderId = `WC-${siteName}-${order.id}`;

    const lineItems = (order.line_items || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        productId: item.product_id,
        variationId: item.variation_id,
        quantity: item.quantity,
        taxClass: item.tax_class,
        subtotal: parseFloat(item.subtotal) || 0,
        subtotalTax: parseFloat(item.subtotal_tax) || 0,
        total: parseFloat(item.total) || 0,
        totalTax: parseFloat(item.total_tax) || 0,
        taxes: item.taxes,
        metaData: item.meta_data,
        sku: item.sku,
        price: item.price,
    }));

    return {
        _id: orderId,
        webId: order.id,
        parentId: order.parent_id,
        number: order.number,
        orderKey: order.order_key,
        createdVia: order.created_via,
        version: order.version,
        status: order.status,
        currency: order.currency,
        dateCreated: order.date_created ? new Date(order.date_created) : null,
        dateModified: order.date_modified ? new Date(order.date_modified) : null,
        discountTotal: parseFloat(order.discount_total) || 0,
        discountTax: parseFloat(order.discount_tax) || 0,
        shippingTotal: parseFloat(order.shipping_total) || 0,
        shippingTax: parseFloat(order.shipping_tax) || 0,
        cartTax: parseFloat(order.cart_tax) || 0,
        total: parseFloat(order.total) || 0,
        totalTax: parseFloat(order.total_tax) || 0,
        pricesIncludeTax: order.prices_include_tax,
        customerId: order.customer_id,
        customerIpAddress: order.customer_ip_address,
        customerUserAgent: order.customer_user_agent,
        customerNote: order.customer_note,
        billing: {
            firstName: order.billing?.first_name,
            lastName: order.billing?.last_name,
            company: order.billing?.company,
            address1: order.billing?.address_1,
            address2: order.billing?.address_2,
            city: order.billing?.city,
            state: order.billing?.state,
            postcode: order.billing?.postcode,
            country: order.billing?.country,
            email: order.billing?.email,
            phone: order.billing?.phone
        },
        shipping: {
            firstName: order.shipping?.first_name,
            lastName: order.shipping?.last_name,
            company: order.shipping?.company,
            address1: order.shipping?.address_1,
            address2: order.shipping?.address_2,
            city: order.shipping?.city,
            state: order.shipping?.state,
            postcode: order.shipping?.postcode,
            country: order.shipping?.country
        },
        paymentMethod: order.payment_method,
        paymentMethodTitle: order.payment_method_title,
        transactionId: order.transaction_id,
        datePaid: order.date_paid ? new Date(order.date_paid) : null,
        dateCompleted: order.date_completed ? new Date(order.date_completed) : null,
        cartHash: order.cart_hash,
        metaData: order.meta_data,
        lineItems,
        shippingLines: order.shipping_lines,
        feeLines: order.fee_lines,
        couponLines: order.coupon_lines,
        refunds: order.refunds,
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
            return NextResponse.json({ error: 'Missing site parameter. Setup your webhook url as /api/webhooks/woocommerce?site=YOUR_SITE_NAME' }, { status: 400 });
        }

        const topic = req.headers.get('x-wc-webhook-topic') || '';
        const rawBodyText = await req.text();
        const signature = req.headers.get('x-wc-webhook-signature');

        // Note: You can verify the WooCommerce webhook signature using crypto.createHmac
        // if you store the webhook secrets for each site. For now, we proceed to parse the body.
        let body;
        try {
            body = JSON.parse(rawBodyText);
        } catch (e) {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }

        if (topic === 'product.created' || topic === 'product.updated') {
            const transformedData = transformProduct(body, site);
            
            // Webhook payload might not have variations loaded if it's just the parent body
            // We use findOneAndUpdate to preserve any variations that might exist
            await WebProduct.findOneAndUpdate(
                { _id: transformedData._id },
                { $set: transformedData },
                { upsert: true }
            );

        } else if (topic === 'order.created' || topic === 'order.updated') {
            const transformedData = transformOrder(body, site);
            
            // Preserve existing lineItems manual additions (like lotNumber/cost)
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
        console.error('WooCommerce Webhook Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
