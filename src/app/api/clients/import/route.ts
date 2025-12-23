import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Client from '@/models/Client';

export async function POST(request: Request) {
    try {
        await dbConnect();
        const { clients } = await request.json();

        if (!Array.isArray(clients)) {
            return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
        }

        const operations = clients.map((row: any) => {
            // Map CSV row to Schema fields

            // Phones array
            const phones = [];
            if (row.phone) phones.push({ value: row.phone, label: 'Main', isWhatsApp: false });
            if (row.phone2) phones.push({ value: row.phone2, label: 'Secondary', isWhatsApp: false });
            if (row.phone3) phones.push({ value: row.phone3, label: 'Other', isWhatsApp: false });
            if (row.whatsApp) phones.push({ value: row.whatsApp, label: 'WhatsApp', isWhatsApp: true });

            // Emails array
            const emails = [];
            if (row.email) emails.push({ value: row.email, label: 'Main' });
            if (row.email2) emails.push({ value: row.email2, label: 'Secondary' });
            if (row.email3) emails.push({ value: row.email3, label: 'Other' });

            // Addresses array
            const addresses = [];
            if (row.address || row.city || row.state || row.postalCode) {
                addresses.push({
                    street: row.address,
                    city: row.city,
                    state: row.state,
                    postalCode: row.postalCode,
                    label: 'Main'
                });
            }
            if (row.address2 || row.city2 || row.state2 || row.postalCode2) {
                addresses.push({
                    street: row.address2,
                    city: row.city2,
                    state: row.state2,
                    postalCode: row.postalCode2,
                    label: 'Secondary'
                });
            }

            // Billing object
            const billing = {
                nameOnCard: row.nameOnCard,
                ccNumber: row.ccNumber,
                expirationDate: row.expirationDate,
                securityCode: row.securityCode,
                zipCode: row.zipCode
            };

            const doc = {
                _id: row.clientid, // Use clientid as _id
                name: row.name,
                description: row.description,
                salesPerson: row.salesPerson,
                contactStatus: row.contactStatus,
                contactType: row.contactType,
                companyType: row.companyType,
                website: row.website,
                facebookPage: row.facebookPage,
                industry: row.industry,
                forecastedAmount: row.forecastedAmount ? parseFloat(row.forecastedAmount) : 0,
                interactionCount: row.interactionCount ? parseInt(row.interactionCount) : 0,
                notes: row.notes ? [{ note: row.notes, createdBy: 'Import', createdAt: new Date() }] : [],
                projectedCloseDate: row.projectedCloseDate ? new Date(row.projectedCloseDate) : undefined,
                phones,
                emails,
                addresses,
                billing,
                defaultShippingTerms: row.defaultShippingTerms,
                defaultPaymentMethod: row.defaultPaymentMethod
            };

            return {
                updateOne: {
                    filter: { _id: row.clientid },
                    update: { $set: doc },
                    upsert: true
                }
            };
        });

        // Bulk write
        if (operations.length > 0) {
            await Client.bulkWrite(operations);
        }

        return NextResponse.json({ message: 'Import successful', count: operations.length });
    } catch (error: any) {
        console.error("Import error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
