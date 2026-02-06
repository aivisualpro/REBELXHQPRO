import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongoose';
import Sku from '@/models/Sku';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        await dbConnect();
        
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        
        if (!id) {
            return NextResponse.json({ error: 'ID parameter required' }, { status: 400 });
        }

        console.log('=== SKU DEBUG CHECK ===');
        console.log('Input ID:', id);
        console.log('Input ID type:', typeof id);
        console.log('Is valid ObjectId:', mongoose.Types.ObjectId.isValid(id));

        // Get the raw document from MongoDB
        const db = mongoose.connection.db;
        const collection = db?.collection('skus');
        
        if (!collection) {
            return NextResponse.json({ error: 'Database not connected' }, { status: 500 });
        }

        // Try to find by ObjectId (standard MongoDB _id type)
        let byObjectId = null;
        if (mongoose.Types.ObjectId.isValid(id)) {
            byObjectId = await collection.findOne({ _id: new mongoose.Types.ObjectId(id) });
            console.log('Found by ObjectId _id:', byObjectId ? 'YES' : 'NO');
            if (byObjectId) {
                console.log('Document _id type (ObjectId):', typeof byObjectId._id);
                console.log('Document _id value (ObjectId):', byObjectId._id);
                console.log('Document _id instanceof ObjectId:', byObjectId._id instanceof mongoose.Types.ObjectId);
            }
        }

        // Try to find by string (in case SKUs use string _id - uncommon)
        const byString = await collection.findOne({ _id: id } as any);
        console.log('Found by string _id:', byString ? 'YES' : 'NO');
        if (byString) {
            console.log('Document _id type (string):', typeof byString._id);
            console.log('Document _id value (string):', byString._id);
        }

        // Try with Mongoose model
        const byModel = await Sku.findById(id).lean();
        console.log('Found by Sku.findById:', byModel ? 'YES' : 'NO');

        // Sample a few SKUs to see their _id types
        const samples = await collection.find({}).limit(5).toArray();
        console.log('\n=== SAMPLE SKUs ===');
        samples.forEach((doc, i) => {
            console.log(`Sample ${i + 1}:`);
            console.log('  _id:', doc._id);
            console.log('  _id type:', typeof doc._id);
            console.log('  _id instanceof ObjectId:', doc._id instanceof mongoose.Types.ObjectId);
            console.log('  name:', doc.name);
        });

        return NextResponse.json({
            inputId: id,
            foundByString: !!byString,
            foundByObjectId: !!byObjectId,
            foundByModel: !!byModel,
            stringResult: byString ? { _id: byString._id, name: byString.name } : null,
            objectIdResult: byObjectId ? { _id: byObjectId._id.toString(), name: byObjectId.name } : null,
            modelResult: byModel ? { _id: byModel._id, name: byModel.name } : null,
            samples: samples.map(s => ({
                _id: s._id.toString(),
                name: s.name,
                idType: typeof s._id,
                isObjectId: s._id instanceof mongoose.Types.ObjectId
            }))
        });

    } catch (error: any) {
        console.error('Debug endpoint error:', error);
        return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
}
