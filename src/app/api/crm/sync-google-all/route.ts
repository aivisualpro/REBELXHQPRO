import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import Client from '@/models/Client';
import Activity from '@/models/Activity';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

export async function GET(request: NextRequest) {
    try {
        await dbConnect();
        
        // 1. Get all users who have connected Google
        const users = await User.find({ googleConnected: true, googleRefreshToken: { $exists: true } });
        
        if (users.length === 0) {
            return NextResponse.json({ message: 'No connected users found to sync.' });
        }

        const results = [];

        // 2. Iterate through each user
        for (const user of users) {
             try {
                const oauth2Client = new google.auth.OAuth2(
                    process.env.GOOGLE_CLIENT_ID,
                    process.env.GOOGLE_CLIENT_SECRET
                );

                oauth2Client.setCredentials({
                    refresh_token: user.googleRefreshToken
                });

                const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
                
                // Query Gmail for Google Voice logs
                // Google Voice can send from multiple addresses:
                // - grandcentral.bounces.google.com (older format)
                // - voice.google.com (newer SMS notifications)
                const daysAgo = new Date();
                daysAgo.setDate(daysAgo.getDate() - 7); // Look back 7 days
                const afterTimestamp = Math.floor(daysAgo.getTime() / 1000);
                
                const query = `(from:grandcentral.bounces.google.com OR from:voice.google.com) after:${afterTimestamp}`;
                
                console.log(`[Sync] Searching Gmail for user ${user.email} with query: ${query}`);
                
                const response = await gmail.users.messages.list({
                    userId: 'me',
                    q: query,
                    maxResults: 100 // Limit to prevent timeout
                });

                const messages = response.data.messages || [];
                let userSyncCount = 0;
                
                console.log(`[Sync] Found ${messages.length} messages for ${user.email}`);

                for (const msg of messages) {
                    const fullMsg = await gmail.users.messages.get({
                        userId: 'me',
                        id: msg.id!
                    });

                    // Extract logic: Look for phone number in subject or body
                    const subject = fullMsg.data.payload?.headers?.find(h => h.name === 'Subject')?.value || '';
                    const body = fullMsg.data.snippet || '';
                    
                    // Robust regex for phone numbers: matches (XXX) XXX-XXXX, XXX-XXX-XXXX, XXXXXXXXXX, etc.
                    const phoneMatch = (subject + ' ' + body).match(/\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}/);
                    
                    if (phoneMatch) {
                        const phoneNumber = phoneMatch[0].replace(/\D/g, '');
                        
                        console.log(`[Sync] Processing message from ${phoneNumber}: ${subject}`);
                        
                        // Find a client with this phone number - try multiple formats
                        const client = await Client.findOne({
                            $or: [
                                { 'phones.value': { $regex: phoneNumber } },
                                { 'phones.value': { $regex: phoneNumber.slice(-10) } }, // Last 10 digits
                                { 'phones.value': { $regex: phoneNumber.slice(-7) } }   // Last 7 digits
                            ]
                        });

                        if (client) {
                            console.log(`[Sync] Matched to client: ${client.name} (${client._id})`);
                            
                            // Check if we already logged this message ID (prevent duplicates)
                            const existing = await Activity.findOne({ 
                                client: client._id,
                                comments: { $regex: msg.id! }
                            });

                            if (!existing) {
                                // Improved type detection for SMS
                                const isSMS = subject.toLowerCase().includes('text') || 
                                             subject.toLowerCase().includes('sms') || 
                                             subject.toLowerCase().includes('message') ||
                                             body.toLowerCase().includes('sent you a text');
                                
                                await Activity.create({
                                    type: isSMS ? 'Text' : 'Call',
                                    client: client._id,
                                    comments: `[Google Voice ID: ${msg.id}] ${subject}: ${body}`,
                                    createdBy: user._id,
                                    createdAt: new Date(parseInt(fullMsg.data.internalDate!))
                                });
                                userSyncCount++;
                                console.log(`[Sync] Created ${isSMS ? 'SMS' : 'Call'} activity for ${client.name}`);
                            } else {
                                console.log(`[Sync] Skipped duplicate message ${msg.id}`);
                            }
                        } else {
                            console.log(`[Sync] No client found for phone number: ${phoneNumber}`);
                        }
                    }
                }

                results.push({ email: user.email, synced: userSyncCount });
            } catch (userErr: any) {
                console.error(`Error syncing for ${user.email}:`, userErr);
                results.push({ email: user.email, error: userErr.message });
            }
        }

        return NextResponse.json({ success: true, results });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
