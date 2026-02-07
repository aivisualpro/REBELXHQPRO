import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import PurchaseOrder from '@/models/PurchaseOrder';
import Vendor from '@/models/Vendor';

export async function POST(request: Request) {
    try {
        await dbConnect();
        const body = await request.json();
        const { data } = body;

        if (!Array.isArray(data)) {
            return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
        }

        // DEBUG: Log ALL headers from first row
        if (data.length > 0) {
            console.log('=== PO IMPORT DEBUG ===');
            console.log('Total rows:', data.length);
            console.log('First row keys:', Object.keys(data[0]));
            console.log('First row raw data:', JSON.stringify(data[0]));
            // Log some paymentTerms samples
            const samples = data.slice(0, 5).map((d: any, i: number) => ({
                row: i,
                paymentTerms: d.paymentTerms,
                payTerms: d.payTerms,
                allKeys: Object.keys(d).filter(k => k.toLowerCase().includes('pay') || k.toLowerCase().includes('term'))
            }));
            console.log('Payment Terms Samples:', JSON.stringify(samples, null, 2));
        }

        // Fetch all vendors to create lookup maps (by name AND legacyId)
        const allVendors = await Vendor.find({}).select('_id name legacyId paymentTerms').lean();
        const vendorMap = new Map();
        const vendorPayTermsMap = new Map(); // Vendor ID -> paymentTerms
        allVendors.forEach((v: any) => {
            if (v.name) vendorMap.set(v.name.trim().toLowerCase(), v._id);
            if (v.legacyId) vendorMap.set(v.legacyId.toString().trim().toLowerCase(), v._id);
            if (v.paymentTerms) vendorPayTermsMap.set(v._id, v.paymentTerms);
        });

        const bulkOps = data.map((item: any, index: number) => {
            const processedItem = { ...item };

            // Map createBy -> createdBy
            if (processedItem.createBy && !processedItem.createdBy) {
                processedItem.createdBy = processedItem.createBy;
                delete processedItem.createBy;
            }

            // Map createAt -> createdAt
            if (processedItem.createAt && !processedItem.createdAt) {
                processedItem.createdAt = new Date(processedItem.createAt);
                delete processedItem.createAt;
            }

            // ---- PAYMENT TERMS RESOLUTION ----
            // Step 1: Check all possible CSV header variations
            if (!processedItem.paymentTerms || String(processedItem.paymentTerms).trim() === '') {
                const keys = Object.keys(processedItem);
                for (const k of keys) {
                    const normalized = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                    if (['paymentterms', 'payterms', 'terms', 'paymentterm', 'payterm'].includes(normalized)) {
                        const val = processedItem[k];
                        if (val && String(val).trim() !== '') {
                            processedItem.paymentTerms = String(val).trim();
                            if (index < 3) console.log(`Row ${index}: Found paymentTerms "${processedItem.paymentTerms}" from key "${k}"`);
                            break;
                        }
                    }
                }
            }

            // Step 2: Resolve Vendor FIRST (we need vendor ID for fallback)
            let resolvedVendorId: string | null = null;
            if (processedItem.vendor) {
                const vKey = String(processedItem.vendor).trim().toLowerCase();
                const vId = vendorMap.get(vKey);
                if (vId) {
                    resolvedVendorId = vId;
                    processedItem.vendor = vId;
                }
            }

            // Step 3: If STILL no paymentTerms, fall back to Vendor's paymentTerms
            if ((!processedItem.paymentTerms || String(processedItem.paymentTerms).trim() === '') && resolvedVendorId) {
                const vendorTerms = vendorPayTermsMap.get(resolvedVendorId);
                if (vendorTerms) {
                    processedItem.paymentTerms = vendorTerms;
                    if (index < 3) console.log(`Row ${index}: Inherited paymentTerms "${vendorTerms}" from vendor`);
                }
            }

            if (index < 3) console.log(`Row ${index} FINAL paymentTerms: "${processedItem.paymentTerms}"`);

            // Remove empty string fields so $set doesn't blank out existing data
            for (const key of Object.keys(processedItem)) {
                if (processedItem[key] === '' || processedItem[key] === undefined) {
                    delete processedItem[key];
                }
            }

            // Parse dates
            if (processedItem.scheduledDelivery) {
                processedItem.scheduledDelivery = new Date(processedItem.scheduledDelivery);
            }
            if (processedItem.receivedDate) {
                processedItem.receivedDate = new Date(processedItem.receivedDate);
            }

            if (processedItem.legacyId) {
                return {
                    updateOne: {
                        filter: { legacyId: processedItem.legacyId },
                        update: { $set: processedItem },
                        upsert: true
                    }
                };
            } else if (processedItem._id) {
                return {
                    updateOne: {
                        filter: { _id: processedItem._id },
                        update: { $set: processedItem },
                        upsert: true
                    }
                };
            } else {
                return {
                    insertOne: {
                        document: processedItem
                    }
                };
            }
        });

        const result = await PurchaseOrder.bulkWrite(bulkOps as any);

        console.log('=== PO IMPORT RESULT ===');
        console.log('Upserted:', result.upsertedCount, 'Modified:', result.modifiedCount, 'Inserted:', result.insertedCount);

        return NextResponse.json({
            message: 'Import completed',
            count: result.upsertedCount + result.modifiedCount + result.insertedCount
        });
    } catch (error: any) {
        console.error('PO Import Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
