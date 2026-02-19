import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import WebProduct from '@/models/WebProduct';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id: skuId } = await context.params;

        // Find web products where linkedSkuId matches (simple products)
        // OR any variation's linkedSkuId matches (variable products)
        const webProducts = await WebProduct.find({
            $or: [
                { linkedSkuId: skuId },
                { 'variations.linkedSkuId': skuId }
            ]
        })
        .select('_id name image website webId type status permalink linkedSkuId variations price salePrice totalWebOrders')
        .sort({ totalWebOrders: -1 })
        .lean();

        // Build a flat list: for variable products, show which variations link here
        const results = webProducts.map((wp: any) => {
            const linkedVariations = (wp.variations || []).filter(
                (v: any) => v.linkedSkuId === skuId
            );
            return {
                _id: wp._id,
                name: wp.name,
                image: wp.image,
                website: wp.website,
                webId: wp.webId,
                type: wp.type,
                status: wp.status,
                permalink: wp.permalink,
                price: wp.price,
                salePrice: wp.salePrice,
                totalWebOrders: wp.totalWebOrders || 0,
                // Direct link (simple product)
                isDirectLink: wp.linkedSkuId === skuId,
                // Linked variations (variable product)
                linkedVariations: linkedVariations.map((v: any) => ({
                    _id: v._id,
                    id: v.id,
                    name: v.name,
                    sku: v.sku,
                    price: v.price,
                    image: v.image,
                })),
            };
        });

        return NextResponse.json({ linkedProducts: results });
    } catch (error: any) {
        console.error('Error fetching linked web products:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
