import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getGmailClient } from '@/lib/google-api';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import Client from '@/models/Client';
import { formatDate } from '@/lib/utils';

// Cache client emails in memory with a TTL
let clientEmailCache: { emails: Set<string>; ts: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/** Load all client email addresses into a Set for O(1) lookups */
async function getClientEmails(): Promise<Set<string>> {
    if (clientEmailCache && Date.now() - clientEmailCache.ts < CACHE_TTL) {
        return clientEmailCache.emails;
    }
    await dbConnect();
    const clients = await Client.find({}, { 'emails.value': 1, 'contacts.email': 1 }).lean();
    const emailSet = new Set<string>();
    for (const client of clients) {
        // Client-level emails
        if ((client as any).emails) {
            for (const e of (client as any).emails) {
                if (e.value) emailSet.add(e.value.toLowerCase().trim());
            }
        }
        // Contact-level emails
        if ((client as any).contacts) {
            for (const c of (client as any).contacts) {
                if (c.email) emailSet.add(c.email.toLowerCase().trim());
            }
        }
    }
    clientEmailCache = { emails: emailSet, ts: Date.now() };
    return emailSet;
}

/** Extract all email addresses from a raw header value like "Name <email>, Other <email2>" */
function extractEmails(headerValue: string): string[] {
    if (!headerValue) return [];
    const matches = headerValue.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g);
    return matches ? matches.map(e => e.toLowerCase().trim()) : [];
}

/** Check if a message involves any client email */
function messageInvolvesClient(msg: any, clientEmails: Set<string>, direction: 'inbox' | 'sent' | 'search'): boolean {
    if (direction === 'inbox') {
        // Inbox: sender must be a client
        const senderEmail = msg.senderEmail?.toLowerCase()?.trim();
        if (senderEmail && clientEmails.has(senderEmail)) return true;
        // Also check raw From header for edge cases
        return extractEmails(msg.senderEmail || '').some(e => clientEmails.has(e));
    } else if (direction === 'sent') {
        // Sent: any recipient (to/cc) must be a client
        const toEmails = extractEmails(msg.recipient || '');
        const ccEmails = extractEmails(msg.cc || '');
        return [...toEmails, ...ccEmails].some(e => clientEmails.has(e));
    } else {
        // Search: any participant is a client
        const allEmails = [
            ...extractEmails(msg.senderEmail || ''),
            ...extractEmails(msg.recipient || ''),
            ...extractEmails(msg.cc || ''),
        ];
        return allEmails.some(e => clientEmails.has(e));
    }
}

// Helper to fetch and parse message details
async function fetchMessageDetails(gmail: any, messages: any[]) {
    return (await Promise.all(
        messages.map(async (msg) => {
            try {
                const details = await gmail.users.messages.get({
                    userId: 'me',
                    id: msg.id!,
                    format: 'full'
                });

                const headers = details.data.payload?.headers || [];
                const findHeader = (name: string) => headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

                const subject = findHeader('Subject') || '(No Subject)';
                const from = findHeader('From') || '(Unknown Sender)';
                const to = findHeader('To') || '(Unknown Recipient)';
                const cc = findHeader('Cc');
                const bcc = findHeader('Bcc');
                const date = findHeader('Date') || '';

                // Extract body and attachments
                let body = '';
                const attachments: any[] = [];

                const processParts = (parts: any[]) => {
                    parts.forEach(part => {
                        if (part.mimeType === 'text/plain' && part.body?.data) {
                            body = Buffer.from(part.body.data, 'base64').toString();
                        } else if (part.filename && part.body?.attachmentId) {
                            attachments.push({
                                id: part.body.attachmentId,
                                filename: part.filename,
                                mimeType: part.mimeType,
                                size: part.body.size
                            });
                        }
                        if (part.parts) processParts(part.parts);
                    });
                };

                if (details.data.payload?.parts) {
                    processParts(details.data.payload.parts);
                } else if (details.data.payload?.body?.data) {
                    body = Buffer.from(details.data.payload.body.data, 'base64').toString();
                }

                // Clean sender name
                let senderName = from;
                const match = from.match(/^"?([^"<]+)"?/);
                if (match && match[1]) {
                    senderName = match[1].trim();
                }

                // Safe date formatting
                const dateObj = date ? new Date(date) : null;
                const isValidDate = dateObj && !isNaN(dateObj.getTime());

                return {
                    id: msg.id,
                    sender: senderName,
                    senderEmail: from.match(/<([^>]+)>/)?.[1] || from,
                    recipient: to,
                    cc,
                    bcc,
                    subject,
                    snippet: details.data.snippet,
                    body,
                    attachments,
                    time: isValidDate ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
                    date: isValidDate ? formatDate(dateObj!.toISOString()) : '',
                    timestamp: isValidDate ? dateObj.getTime() : 0,
                    isRead: !details.data.labelIds?.includes('UNREAD'),
                    isStarred: details.data.labelIds?.includes('STARRED'),
                    labelIds: details.data.labelIds || [],
                    hasAttachments: attachments.length > 0,
                };
            } catch (e) {
                console.error(`Error fetching message details for ${msg.id}:`, e);
                return null;
            }
        })
    )).filter(m => m !== null);
}

export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const label = searchParams.get('label');
    const q = searchParams.get('q');
    const pageToken = searchParams.get('pageToken');
    const attachmentId = searchParams.get('attachmentId');
    const messageId = searchParams.get('messageId');

    try {
        // If searching (q exists), we search across ALL connected users
        // If traversing inbox (label exists, q missing), we only check current user

        let detailedMessages: any[] = [];
        let nextPageToken = null;
        let resultSizeEstimate = 0;
        let unreadCount = 0;

        if (q) {
            // GLOBAL SEARCH ACROSS ALL CONNECTED USERS
            await dbConnect();
            // Assuming User model has googleConnected field as per User.ts
            const users = await User.find({ googleConnected: true });
            console.log(`Global search '${q}' across ${users.length} connected users`);

            const allResults = await Promise.all(users.map(async (user) => {
                try {
                    const gmail = await getGmailClient(user._id as string);
                    const listResponse = await gmail.users.messages.list({
                        userId: 'me',
                        q: q,
                        maxResults: 20 // Fetch top 20 from each user to combine
                    });

                    const messages = listResponse.data.messages || [];
                    if (messages.length === 0) return [];

                    return await fetchMessageDetails(gmail, messages);
                } catch (err) {
                    // Fail silently for individual user errors (token exp, etc) during global search
                    console.warn(`Failed to search emails for user ${user.email}:`, err);
                    return [];
                }
            }));

            detailedMessages = allResults.flat();
            // Sort merged results by timestamp descending
            detailedMessages.sort((a, b) => b.timestamp - a.timestamp);

            // Filter to only show emails involving client emails
            const clientEmails = await getClientEmails();
            detailedMessages = detailedMessages.filter(msg => messageInvolvesClient(msg, clientEmails, 'search'));

            resultSizeEstimate = detailedMessages.length;

        } else {
            // STANDARD SINGLE USER MODE
            const gmail = await getGmailClient(session.user.id);

            if (attachmentId && messageId) {
                const res = await gmail.users.messages.attachments.get({
                    userId: 'me',
                    messageId: messageId,
                    id: attachmentId
                });

                const data = res.data.data;
                if (!data) return NextResponse.json({ error: 'Attachment data not found' }, { status: 404 });

                return new Response(Buffer.from(data, 'base64'), {
                    headers: {
                        'Content-Disposition': `attachment; filename="attachment"`,
                    },
                });
            }

            // Fetch more messages to have enough after client filtering
            const listResponse = await gmail.users.messages.list({
                userId: 'me',
                q: label === 'SENT' ? 'in:sent' : 'in:inbox',
                maxResults: 200,
                pageToken: pageToken || undefined
            });

            const messages = listResponse.data.messages || [];
            console.log(`Found ${messages.length} messages for current user in ${label || 'Inbox'}`);

            const allMessages = await fetchMessageDetails(gmail, messages);

            // Filter to only show emails involving client emails
            const clientEmails = await getClientEmails();
            const direction = label === 'SENT' ? 'sent' : 'inbox';
            detailedMessages = allMessages.filter(msg => messageInvolvesClient(msg, clientEmails, direction));
            console.log(`After client filter: ${detailedMessages.length} of ${allMessages.length} messages`);

            nextPageToken = listResponse.data.nextPageToken;
            resultSizeEstimate = detailedMessages.length;

            // Fetch unread count only for current user context
            try {
                const inboxInfo = await gmail.users.labels.get({
                    userId: 'me',
                    id: 'INBOX'
                });
                unreadCount = inboxInfo.data.messagesUnread || 0;
            } catch (e) {
                console.warn('Could not fetch unread count');
            }
        }

        return NextResponse.json({
            emails: detailedMessages,
            nextPageToken,
            resultSizeEstimate,
            unreadCount
        });
    } catch (error: any) {
        console.error('Gmail API Main Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { messageId, action } = await request.json();
        const gmail = await getGmailClient(session.user.id);

        if (action === 'READ') {
            await gmail.users.messages.batchModify({
                userId: 'me',
                requestBody: {
                    ids: [messageId],
                    removeLabelIds: ['UNREAD']
                }
            });
        } else if (action === 'UNREAD') {
            await gmail.users.messages.batchModify({
                userId: 'me',
                requestBody: {
                    ids: [messageId],
                    addLabelIds: ['UNREAD']
                }
            });
        } else if (action === 'STAR') {
            await gmail.users.messages.batchModify({
                userId: 'me',
                requestBody: {
                    ids: [messageId],
                    addLabelIds: ['STARRED']
                }
            });
        } else if (action === 'UNSTAR') {
            await gmail.users.messages.batchModify({
                userId: 'me',
                requestBody: {
                    ids: [messageId],
                    removeLabelIds: ['STARRED']
                }
            });
        } else if (action === 'TRASH') {
            await gmail.users.messages.trash({
                userId: 'me',
                id: messageId
            });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Gmail Update Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { to, subject, body } = await request.json();
        const gmail = await getGmailClient(session.user.id);

        const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
        const messageParts = [
            `To: ${to}`,
            'Content-Type: text/plain; charset=utf-8',
            'MIME-Version: 1.0',
            `Subject: ${utf8Subject}`,
            '',
            body,
        ];
        const message = messageParts.join('\n');

        const encodedMessage = Buffer.from(message)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encodedMessage,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Gmail Send Error:', error);

        // Check for insufficient scopes error
        if (error.code === 403 || error.message?.includes('insufficient authentication scopes')) {
            return NextResponse.json({
                error: 'Missing permission to send emails. Please reconnect your Google account from your Profile page to grant email sending permissions.',
                code: 'INSUFFICIENT_SCOPES'
            }, { status: 403 });
        }

        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
