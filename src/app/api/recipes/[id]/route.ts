import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import { Recipe } from '@/models/Recipe';
import Sku from '@/models/Sku';
import User from '@/models/User';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

async function hydrateRecipeSkus(recipe: any) {
    if (!recipe) return recipe;

    // Collect all SKU IDs (root + lineItems)
    const allSkuIds = new Set<string>();
    if (recipe.sku) allSkuIds.add(String(recipe.sku));
    recipe.lineItems?.forEach((li: any) => {
        if (li.sku) allSkuIds.add(String(li.sku));
    });

    if (allSkuIds.size === 0) return recipe;

    const skuIdArr = Array.from(allSkuIds);

    // Hybrid lookup via native driver on the Sku model's collection
    const orConditions: any[] = [
        { _id: { $in: skuIdArr } }
    ];
    const validOids = skuIdArr.filter(id => /^[0-9a-f]{24}$/i.test(id));
    if (validOids.length > 0) {
        orConditions.push({ _id: { $in: validOids.map(id => new mongoose.Types.ObjectId(id)) } });
    }

    try {
        const skuDocs = await Sku.collection.find(
            { $or: orConditions },
            { projection: { _id: 1, name: 1 } }
        ).toArray();

        const skuMap = new Map<string, { _id: string; name: string }>();
        skuDocs.forEach((s: any) => {
            skuMap.set(String(s._id), { _id: String(s._id), name: s.name });
        });

        // Hydrate root SKU
        const rootSkuId = recipe.sku ? String(recipe.sku) : null;
        const rootSkuDoc = rootSkuId ? skuMap.get(rootSkuId) : null;
        if (rootSkuDoc) {
            recipe.sku = { _id: rootSkuDoc._id, name: rootSkuDoc.name };
        }

        // Hydrate line item SKUs
        recipe.lineItems = recipe.lineItems?.map((li: any) => {
            const liSkuId = li.sku ? String(li.sku) : null;
            const liSkuDoc = liSkuId ? skuMap.get(liSkuId) : null;
            return {
                ...li,
                sku: liSkuDoc ? { _id: liSkuDoc._id, name: liSkuDoc.name } : li.sku
            };
        }) || [];
    } catch (err) {
        console.error('SKU hydration error:', err);
    }

    return recipe;
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const { id } = await context.params;
        void Sku;
        void User;

        const recipe = await Recipe.findById(id)
            .populate('createdBy', 'firstName lastName')
            .lean();

        if (!recipe) {
            return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
        }

        const hydrated = await hydrateRecipeSkus(recipe);
        return NextResponse.json(hydrated);

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const { id } = await context.params;
        const body = await request.json();
        const updatedRecipe = await Recipe.findByIdAndUpdate(id, body, { new: true })
            .populate('createdBy', 'firstName lastName')
            .lean();

        if (!updatedRecipe) {
            return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
        }

        const hydrated = await hydrateRecipeSkus(updatedRecipe);
        return NextResponse.json(hydrated);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        await dbConnect();
        const { id } = await context.params;
        const deletedRecipe = await Recipe.findByIdAndDelete(id);

        if (!deletedRecipe) {
            return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Recipe deleted successfully' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
