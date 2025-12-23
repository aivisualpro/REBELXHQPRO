import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Sku from '@/models/Sku';
import mongoose from 'mongoose';

export async function POST(request: Request) {
    try {
        await dbConnect();
        const body = await request.json();
        const { variances } = body;

        if (!Array.isArray(variances)) {
            return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
        }

        const operations = variances
            .filter((item: any) => item.sku && item.name)
            .map((item: any) => ({
                updateOne: {
                    filter: { _id: item.sku }, // Match SKU by its ID (which is the sku string)
                    update: {
                        $push: {
                            variances: {
                                _id: item._id || new mongoose.Types.ObjectId().toString(),
                                name: item.name,
                                website: item.website,
                                image: item.image
                            }
                        }
                    }
                }
            }));

        if (operations.length === 0) {
            return NextResponse.json({ message: 'No valid variances to import', count: 0 });
        }

        const result = await Sku.bulkWrite(operations as any);

        return NextResponse.json({
            message: 'Variances import completed',
            count: result.modifiedCount
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
