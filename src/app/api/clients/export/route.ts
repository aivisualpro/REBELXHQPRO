import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Client from '@/models/Client';
import SaleOrder from '@/models/SaleOrder';
import Activity from '@/models/Activity';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s for large exports

export async function GET() {
    try {
        await dbConnect();

        // Fetch ALL clients (both clients and leads — every record in the collection)
        const allClients = await Client.find({}).lean();

        if (allClients.length === 0) {
            return new NextResponse('No records found', { status: 404 });
        }

        const clientIds = allClients.map((c: any) => c._id);

        // Enrich with financial + activity data in parallel
        const [balanceAgg, activityAgg] = await Promise.all([
            SaleOrder.aggregate([
                { $match: { clientId: { $in: clientIds }, orderStatus: { $ne: 'Cancelled' } } },
                {
                    $project: {
                        clientId: 1,
                        revenue: {
                            $subtract: [
                                { $add: [{ $sum: "$lineItems.total" }, { $ifNull: ["$shippingCost", 0] }, { $ifNull: ["$tax", 0] }] },
                                { $ifNull: ["$discount", 0] }
                            ]
                        },
                        paid: { $sum: "$payments.paymentAmount" }
                    }
                },
                {
                    $group: {
                        _id: '$clientId',
                        totalRev: { $sum: '$revenue' },
                        totalPaid: { $sum: '$paid' },
                        count: { $sum: 1 }
                    }
                }
            ]),
            Activity.aggregate([
                { $match: { client: { $in: clientIds } } },
                {
                    $group: {
                        _id: '$client',
                        activityCount: { $sum: 1 },
                        emailCount: { $sum: { $cond: [{ $eq: ['$type', 'Email'] }, 1, 0] } },
                        callCount: { $sum: { $cond: [{ $eq: ['$type', 'Call'] }, 1, 0] } },
                        smsCount: { $sum: { $cond: [{ $eq: ['$type', 'Text'] }, 1, 0] } },
                        lastActivity: { $max: '$createdAt' }
                    }
                }
            ])
        ]);

        const balanceMap = new Map(balanceAgg.map((r: any) => [r._id.toString(), r]));
        const activityMap = new Map(activityAgg.map((a: any) => [a._id.toString(), a]));

        // Resolve salesPerson names
        const salesRepIds = [...new Set(allClients.map((c: any) => c.salesPerson).filter((id: any) => id && typeof id === 'string'))];
        let userMap = new Map();
        try {
            const users = await mongoose.model('RXHQUsers').find({ _id: { $in: salesRepIds } }, 'firstName lastName').lean();
            userMap = new Map(users.map((u: any) => [u._id.toString(), u]));
        } catch { /* model may not exist */ }

        // Build flat CSV rows
        const rows = allClients.map((c: any) => {
            const cid = c._id.toString();
            const bal = balanceMap.get(cid) || { totalRev: 0, totalPaid: 0, count: 0 };
            const act = activityMap.get(cid) || { activityCount: 0, emailCount: 0, callCount: 0, smsCount: 0, lastActivity: null };
            const rep = userMap.get(c.salesPerson?.toString());

            return {
                '_id': cid,
                'legacyId': c.legacyId || '',
                'name': c.name || '',
                'description': c.description || '',
                'salesPerson': rep ? `${rep.firstName} ${rep.lastName}` : (c.salesPerson || ''),
                'contactStatus': c.contactStatus || '',
                'contactType': c.contactType || '',
                'companyType': c.companyType || '',
                'website': c.website || '',
                'facebookPage': c.facebookPage || '',
                'industry': c.industry || '',
                'forecastedAmount': c.forecastedAmount ?? '',
                'interactionCount': c.interactionCount ?? '',
                'projectedCloseDate': c.projectedCloseDate ? new Date(c.projectedCloseDate).toISOString() : '',
                'defaultShippingTerms': c.defaultShippingTerms || '',
                'defaultPaymentMethod': c.defaultPaymentMethod || '',

                // Flattened phones (up to 3)
                'phone1': c.phones?.[0]?.value || '',
                'phone1Label': c.phones?.[0]?.label || '',
                'phone1IsWhatsApp': c.phones?.[0]?.isWhatsApp ? 'Yes' : '',
                'phone2': c.phones?.[1]?.value || '',
                'phone2Label': c.phones?.[1]?.label || '',
                'phone3': c.phones?.[2]?.value || '',
                'phone3Label': c.phones?.[2]?.label || '',

                // Flattened emails (up to 3)
                'email1': c.emails?.[0]?.value || '',
                'email1Label': c.emails?.[0]?.label || '',
                'email2': c.emails?.[1]?.value || '',
                'email2Label': c.emails?.[1]?.label || '',
                'email3': c.emails?.[2]?.value || '',
                'email3Label': c.emails?.[2]?.label || '',

                // Flattened addresses (up to 2)
                'address1Street': c.addresses?.[0]?.street || '',
                'address1City': c.addresses?.[0]?.city || '',
                'address1State': c.addresses?.[0]?.state || '',
                'address1PostalCode': c.addresses?.[0]?.postalCode || '',
                'address1Country': c.addresses?.[0]?.country || '',
                'address1Label': c.addresses?.[0]?.label || '',
                'address2Street': c.addresses?.[1]?.street || '',
                'address2City': c.addresses?.[1]?.city || '',
                'address2State': c.addresses?.[1]?.state || '',
                'address2PostalCode': c.addresses?.[1]?.postalCode || '',
                'address2Country': c.addresses?.[1]?.country || '',
                'address2Label': c.addresses?.[1]?.label || '',

                // Flattened primary contact
                'contact1FirstName': c.contacts?.[0]?.firstName || '',
                'contact1LastName': c.contacts?.[0]?.lastName || '',
                'contact1Email': c.contacts?.[0]?.email || '',
                'contact1Phone': c.contacts?.[0]?.phone || '',
                'contact1PhoneType': c.contacts?.[0]?.phoneType || '',
                'contact1Role': c.contacts?.[0]?.role || '',
                'contact1Status': c.contacts?.[0]?.status || '',

                // Notes count + latest note
                'notesCount': c.notes?.length || 0,
                'latestNote': c.notes?.length > 0 ? (c.notes[c.notes.length - 1]?.note || '') : '',

                // Billing
                'billingNameOnCard': c.billing?.nameOnCard || '',
                'billingZipCode': c.billing?.zipCode || '',

                // Financial (enriched)
                'totalRevenue': (bal.totalRev || 0).toFixed(2),
                'totalPaid': (bal.totalPaid || 0).toFixed(2),
                'balance': ((bal.totalRev || 0) - (bal.totalPaid || 0)).toFixed(2),
                'orderCount': bal.count || 0,

                // Activity (enriched)
                'activityCount': act.activityCount || 0,
                'emailActivityCount': act.emailCount || 0,
                'callActivityCount': act.callCount || 0,
                'smsActivityCount': act.smsCount || 0,
                'lastActivity': act.lastActivity ? new Date(act.lastActivity).toISOString() : '',

                // Timestamps
                'createdAt': c.createdAt ? new Date(c.createdAt).toISOString() : '',
                'updatedAt': c.updatedAt ? new Date(c.updatedAt).toISOString() : '',
            };
        });

        // Build CSV string
        const headers = Object.keys(rows[0]);
        const csvLines = [
            headers.map(h => `"${h}"`).join(','),
            ...rows.map(row =>
                headers.map(h => {
                    const val = String((row as any)[h] ?? '').replace(/"/g, '""');
                    return `"${val}"`;
                }).join(',')
            )
        ];

        const csv = csvLines.join('\n');
        const filename = `crm_export_clients_leads_${new Date().toISOString().slice(0, 10)}.csv`;

        return new NextResponse(csv, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        });
    } catch (error: any) {
        console.error('Export CSV Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
