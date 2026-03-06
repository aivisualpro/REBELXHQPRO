import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import WebProduct from '@/models/WebProduct';
import Sku from '@/models/Sku';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await context.params;
        const product = await WebProduct.findById(id).lean();

        if (!product) {
            return NextResponse.json({ error: 'Web Product not found' }, { status: 404 });
        }

        // Resolve linked SKU names
        const linkedSkuIds: string[] = [];
        if ((product as any).linkedSkuId) linkedSkuIds.push((product as any).linkedSkuId);
        if ((product as any).variations) {
            for (const v of (product as any).variations) {
                if (v.linkedSkuId) linkedSkuIds.push(v.linkedSkuId);
            }
        }

        if (linkedSkuIds.length > 0) {
            const uniqueIds = [...new Set(linkedSkuIds)];
            const skus = await Sku.find({ _id: { $in: uniqueIds } }).select('_id name').lean();
            const skuMap = new Map(skus.map((s: any) => [s._id.toString(), s.name]));

            if ((product as any).linkedSkuId) {
                (product as any).linkedSkuName = skuMap.get((product as any).linkedSkuId) || null;
            }
            if ((product as any).variations) {
                for (const v of (product as any).variations) {
                    if (v.linkedSkuId) {
                        v.linkedSkuName = skuMap.get(v.linkedSkuId) || null;
                    }
                }
            }
        }

        return NextResponse.json(product);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await context.params;
        const body = await request.json();

        const updatedProduct = await WebProduct.findByIdAndUpdate(
            id,
            { $set: body },
            { new: true, runValidators: true }
        );

        if (!updatedProduct) {
            return NextResponse.json({ error: 'Web Product not found' }, { status: 404 });
        }

        return NextResponse.json(updatedProduct);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await context.params;
        const deletedProduct = await WebProduct.findByIdAndDelete(id);

        if (!deletedProduct) {
            return NextResponse.json({ error: 'Web Product not found' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Web Product deleted successfully' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
