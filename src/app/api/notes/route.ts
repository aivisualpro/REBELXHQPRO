
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Client from '@/models/Client';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(request.url);

        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const search = searchParams.get('search') || '';

        const clientId = searchParams.get('clientId');
        const skip = (page - 1) * limit;

        const pipeline: any[] = [];

        // If clientId is provided, filter the clients first
        if (clientId) {
            pipeline.push({
                $match: mongoose.isValidObjectId(clientId)
                    ? { $or: [{ _id: new mongoose.Types.ObjectId(clientId) }, { legacyId: clientId }] }
                    : { legacyId: clientId }
            });
        }

        pipeline.push(
            { $unwind: '$notes' },
            {
                $lookup: {
                    from: 'rxhqusers',
                    localField: 'notes.createdBy',
                    foreignField: '_id',
                    as: 'creator'
                }
            },
            {
                $unwind: { path: '$creator', preserveNullAndEmptyArrays: true }
            },
            {
                $project: {
                    _id: 0,
                    clientId: '$_id',
                    clientName: '$name',
                    noteId: '$notes._id',
                    note: '$notes.note',
                    createdBy: {
                        $cond: {
                            if: { $ifNull: ['$creator', false] },
                            then: { $concat: ['$creator.firstName', ' ', '$creator.lastName'] },
                            else: '$notes.createdBy'
                        }
                    },
                    createdAt: '$notes.createdAt'
                }
            }
        );

        if (search) {
            pipeline.push({
                $match: {
                    $or: [
                        { note: { $regex: search, $options: 'i' } },
                        { clientName: { $regex: search, $options: 'i' } },
                        { createdBy: { $regex: search, $options: 'i' } }
                    ]
                }
            });
        }

        pipeline.push({ $sort: { createdAt: -1 } });

        const [result] = await Client.aggregate([
            {
                $facet: {
                    metadata: [
                        ...pipeline,
                        { $count: 'total' }
                    ],
                    data: [
                        ...pipeline,
                        { $skip: skip },
                        { $limit: limit }
                    ]
                }
            }
        ]);

        const total = result.metadata[0]?.total || 0;
        const notes = result.data || [];

        return NextResponse.json({
            notes,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        console.error("GET Notes Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
