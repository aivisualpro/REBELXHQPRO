import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Client from '@/models/Client';

export async function POST(request: Request) {
    try {
        await dbConnect();
        const body = await request.json();
        const { data } = body;
        
        const contacts = Array.isArray(data) ? data : body.contacts;

        if (!Array.isArray(contacts)) {
            return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
        }

        // Debug logging
        if (contacts.length > 0) {
            console.log('Contact Import - Total rows:', contacts.length);
            console.log('Contact Import - Headers:', Object.keys(contacts[0]));
            console.log('Contact Import - First row:', JSON.stringify(contacts[0]).substring(0, 500));
        }

        // Group contacts by clientid (which maps to Client.legacyId)
        const contactsByClient = new Map<string, any[]>();
        
        const validContacts = contacts.filter((item: any) => {
            const clientId = item.clientid || item.clientId || item.legacyId;
            return clientId && (item.firstName || item.lastName || item.email);
        });

        validContacts.forEach((item: any) => {
            const clientId = item.clientid || item.clientId || item.legacyId;
            if (!contactsByClient.has(clientId)) {
                contactsByClient.set(clientId, []);
            }

            contactsByClient.get(clientId)!.push({
                firstName: item.firstName || '',
                lastName: item.lastName || '',
                email: item.email || '',
                phone: item.phone || '',
                phoneType: item.phoneType || '',
                extension: item.extension || '',
                role: item.role || '',
                status: item.status || 'Active',
                address: item.address || '',
                city: item.city || '',
                state: item.state || '',
                zipCode: item.zipCode || '',
                country: item.country || '',
                website: item.website || '',
                communicationPreference: item.communicationPreference || '',
                followUpFrequency: item.followUpFrequency || '',
                // Dedup key: first+last+email
                _importKey: `${(item.firstName || '').toLowerCase()}_${(item.lastName || '').toLowerCase()}_${(item.email || '').toLowerCase()}`
            });
        });

        let importedCount = 0;
        let skippedDuplicates = 0;
        let clientsNotFound = 0;

        for (const [clientLegacyId, clientContacts] of contactsByClient) {
            const client = await Client.findOne({ legacyId: clientLegacyId }).select('contacts').lean();
            
            if (!client) {
                console.log(`Contact Import - Client not found for legacyId: ${clientLegacyId}`);
                clientsNotFound++;
                continue;
            }

            // Build set of existing contact keys to detect duplicates
            const existingKeys = new Set<string>();
            if (client.contacts && Array.isArray(client.contacts)) {
                client.contacts.forEach((c: any) => {
                    const key = `${(c.firstName || '').toLowerCase()}_${(c.lastName || '').toLowerCase()}_${(c.email || '').toLowerCase()}`;
                    existingKeys.add(key);
                });
            }

            // Filter out duplicates
            const newContacts = clientContacts.filter(c => {
                if (existingKeys.has(c._importKey)) {
                    skippedDuplicates++;
                    return false;
                }
                return true;
            }).map(c => {
                const { _importKey, ...contactData } = c;
                return contactData;
            });

            if (newContacts.length > 0) {
                await Client.updateOne(
                    { legacyId: clientLegacyId },
                    { $push: { contacts: { $each: newContacts } } }
                );
                importedCount += newContacts.length;
            }
        }

        return NextResponse.json({ 
            message: 'Import completed', 
            count: importedCount,
            skippedDuplicates,
            clientsNotFound,
            totalProcessed: validContacts.length
        });
    } catch (error: any) {
        console.error("Import Contacts Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
