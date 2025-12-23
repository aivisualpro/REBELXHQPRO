import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Client from '@/models/Client';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(request.url);

        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const sortBy = searchParams.get('sortBy') || 'name';
        const sortOrder = searchParams.get('sortOrder') === 'desc' ? -1 : 1;
        const search = searchParams.get('search') || '';

        const salesPerson = searchParams.get('salesPerson');
        const contactStatus = searchParams.get('contactStatus');
        const contactType = searchParams.get('contactType');
        const companyType = searchParams.get('companyType');
        const city = searchParams.get('city');
        const state = searchParams.get('state');
        const defaultShippingTerms = searchParams.get('defaultShippingTerms');

        let query: any = {};

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { 'emails.value': { $regex: search, $options: 'i' } },
                { 'phones.value': { $regex: search, $options: 'i' } },
                // { salesPerson: { $regex: search, $options: 'i' } }, // Can't regex ObjectId ref easily if not populated in query, removing for now or needs aggregate
            ];
        }

        if (salesPerson) {
            query.salesPerson = { $in: salesPerson.split(',') };
        }
        if (contactStatus) {
            query.contactStatus = { $in: contactStatus.split(',') };
        }
        if (contactType) {
            query.contactType = { $in: contactType.split(',') };
        }
        if (companyType) {
            query.companyType = { $in: companyType.split(',') };
        }
        if (defaultShippingTerms) {
            query.defaultShippingTerms = { $in: defaultShippingTerms.split(',') };
        }
        if (city) {
            query['addresses.city'] = { $in: city.split(',').map(c => new RegExp(c, 'i')) };
        }
        if (state) {
            query['addresses.state'] = { $in: state.split(',').map(s => new RegExp(s, 'i')) };
        }

        const [total, clients] = await Promise.all([
            Client.countDocuments(query),
            Client.find(query)
                .populate('salesPerson', 'firstName lastName')
                .sort({ [sortBy]: sortOrder as any })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean()
        ]);

        return NextResponse.json({
            clients,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        await dbConnect();
        const body = await request.json();

        // If no _id provided, Mongo will generate one.
        // But if client intends to use specific _id (clientid), it must be in body.
        const newClient = await Client.create(body);

        return NextResponse.json(newClient);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
