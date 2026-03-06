import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import mongoose from 'mongoose';
import Manufacturing from '@/models/Manufacturing';
import Sku from '@/models/Sku';
import { Recipe } from '@/models/Recipe';

export const dynamic = 'force-dynamic';

/**
 * GET /api/manufacturing/[id]/edit-data
 * 
 * Single endpoint that returns everything the Edit form needs in ONE call:
 *   - The manufacturing order (lean, minimal fields)
 *   - SKU options (id + name + uom only)
 *   - Recipe options (id + name + sku ref + lineItems for regeneration)
 */
export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        void Sku;
        void Recipe;

        const { id } = await context.params;

        // Fetch all 3 in parallel — single round-trip from the browser
        const [order, skus, recipes] = await Promise.all([
            Manufacturing.findById(id)
                .select('sku recipesId label qty uom scheduledStart scheduledFinish priority status')
                .lean(),

            // Minimal SKU list: only _id, name, uom
            mongoose.connection.db!.collection('skus').find(
                {},
                { projection: { _id: 1, name: 1, uom: 1 } }
            ).sort({ name: 1 }).toArray(),

            // Recipes: id, name, sku ref, lineItems for regeneration
            Recipe.find({})
                .select('_id name sku lineItems')
                .populate('sku', '_id')
                .lean()
        ]);

        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Extract plain sku/recipe IDs
        const skuId = typeof order.sku === 'object' && order.sku !== null
            ? (order.sku as any)._id?.toString()
            : order.sku?.toString();

        const recipeId = typeof order.recipesId === 'object' && order.recipesId !== null
            ? (order.recipesId as any)._id?.toString()
            : order.recipesId?.toString();

        return NextResponse.json({
            order: {
                ...order,
                sku: skuId || '',
                recipesId: recipeId || '',
            },
            skus: skus.map((s: any) => ({
                _id: s._id.toString(),
                name: s.name,
                uom: s.uom || 'ea'
            })),
            recipes: recipes.map((r: any) => ({
                _id: r._id.toString(),
                name: r.name,
                sku: typeof r.sku === 'object' ? r.sku?._id?.toString() : r.sku?.toString(),
                lineItems: r.lineItems
            }))
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
