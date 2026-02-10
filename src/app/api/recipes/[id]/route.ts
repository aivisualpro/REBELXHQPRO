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
    if (recipe.sku) allSkuIds.add(recipe.sku.toString());
    recipe.lineItems?.forEach((li: any) => {
        if (li.sku) allSkuIds.add(li.sku.toString());
    });

    if (allSkuIds.size === 0) return recipe;

    const skuIdArr = Array.from(allSkuIds);
    const db = mongoose.connection.db!;
    const skusCol = db.collection('skus');

    // Hybrid lookup: try both String and ObjectId types
    const orConditions: any[] = [
        { _id: { $in: skuIdArr } }
    ];
    const validOids = skuIdArr.filter(id => mongoose.Types.ObjectId.isValid(id));
    if (validOids.length > 0) {
        orConditions.push({ _id: { $in: validOids.map(id => new mongoose.Types.ObjectId(id)) } });
    }

    const skuDocs = await skusCol.find(
        { $or: orConditions },
        { projection: { _id: 1, name: 1 } }
    ).toArray();

    const skuMap = new Map<string, { _id: string; name: string }>();
    skuDocs.forEach((s: any) => {
        skuMap.set(s._id.toString(), { _id: s._id.toString(), name: s.name });
    });

    // Hydrate root SKU
    const rootSkuId = recipe.sku?.toString();
    const rootSkuDoc = rootSkuId ? skuMap.get(rootSkuId) : null;
    if (rootSkuDoc) {
        recipe.sku = { _id: rootSkuDoc._id, name: rootSkuDoc.name };
    }

    // Hydrate line item SKUs
    recipe.lineItems = recipe.lineItems?.map((li: any) => {
        const liSkuId = li.sku?.toString();
        const liSkuDoc = liSkuId ? skuMap.get(liSkuId) : null;
        return {
            ...li,
            sku: liSkuDoc ? { _id: liSkuDoc._id, name: liSkuDoc.name } : li.sku
        };
    }) || [];

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
