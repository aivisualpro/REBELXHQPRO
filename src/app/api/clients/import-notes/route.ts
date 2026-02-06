import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Client from '@/models/Client';

export async function POST(request: Request) {
    try {
        await dbConnect();
        const body = await request.json();
        const { data } = body; // Support new 'data' key from settings import pattern
        
        const notes = Array.isArray(data) ? data : body.notes; // Fallback to old format

        if (!Array.isArray(notes)) {
            return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
        }

        // Group notes by clientid/legacyId to batch process
        const notesByClient = new Map<string, any[]>();
        
        notes
            .filter((item: any) => (item.clientid || item.legacyId || item.clientLegacyId) && item.note)
            .forEach((item: any) => {
                const clientId = item.clientid || item.legacyId || item.clientLegacyId;
                if (!notesByClient.has(clientId)) {
                    notesByClient.set(clientId, []);
                }
                
                // Parse date and author with smart detection for swapped fields
                let noteDate = new Date();
                let author = item.createdBy || 'Import';

                // If item.createdBy looks like a date and item.createdAt looks like an email
                if (item.createdAt && item.createdAt.includes('@')) {
                    author = item.createdAt;
                    if (item.createdBy && !isNaN(Date.parse(item.createdBy))) {
                        noteDate = new Date(item.createdBy);
                    }
                } else if (item.createdAt && !isNaN(Date.parse(item.createdAt))) {
                    noteDate = new Date(item.createdAt);
                    author = item.createdBy || 'Import';
                }

                notesByClient.get(clientId)!.push({
                    note: item.note,
                    createdBy: author,
                    createdAt: noteDate,
                    // Use a hash of note content + date to detect duplicates
                    _importKey: `${item.note.substring(0, 50)}_${noteDate.toISOString().split('T')[0]}`
                });
            });

        let updatedCount = 0;
        let skippedDuplicates = 0;

        // Process each client's notes
        for (const [clientLegacyId, clientNotes] of notesByClient) {
            // Find the client and get existing notes
            const client = await Client.findOne({ legacyId: clientLegacyId }).select('notes').lean();
            
            if (!client) {
                console.log(`Client not found for legacyId: ${clientLegacyId}`);
                continue;
            }

            // Get existing note keys to detect duplicates
            const existingNoteKeys = new Set<string>();
            if (client.notes && Array.isArray(client.notes)) {
                client.notes.forEach((n: any) => {
                    const key = `${(n.note || '').substring(0, 50)}_${n.createdAt ? new Date(n.createdAt).toISOString().split('T')[0] : ''}`;
                    existingNoteKeys.add(key);
                });
            }

            // Filter out duplicate notes
            const newNotes = clientNotes.filter(n => {
                if (existingNoteKeys.has(n._importKey)) {
                    skippedDuplicates++;
                    return false;
                }
                return true;
            }).map(n => {
                // Remove the temporary _importKey before saving
                const { _importKey, ...noteData } = n;
                return noteData;
            });

            if (newNotes.length > 0) {
                await Client.updateOne(
                    { legacyId: clientLegacyId },
                    { $push: { notes: { $each: newNotes } } }
                );
                updatedCount += newNotes.length;
            }
        }

        return NextResponse.json({ 
            message: 'Import completed', 
            updatedCount,
            skippedDuplicates,
            totalProcessed: notes.filter((n: any) => n.note).length
        });
    } catch (error: any) {
        console.error("Import Notes Error Full:", error);
        return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
}
