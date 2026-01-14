import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getGmailClient } from '@/lib/google-api';

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
        
        // Fetch list of messages
        const listResponse = await gmail.users.messages.list({
            userId: 'me',
            q: q || (label === 'SENT' ? 'in:sent' : 'in:inbox'),
            maxResults: 50,
            pageToken: pageToken || undefined
        });

        const messages = listResponse.data.messages || [];
        console.log(`Found ${messages.length} messages for query: ${q || label || 'Inbox'}`);
        
        // Fetch details for each message
        const detailedMessages = (await Promise.all(
            messages.map(async (msg) => {
                try {
                    const details = await gmail.users.messages.get({
                        userId: 'me',
                        id: msg.id!,
                        format: 'full'
                    });

                    const headers = details.data.payload?.headers || [];
                    const findHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';
                    
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
                        date: isValidDate ? dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' }) : '',
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

        // Fetch unread count
        let unreadCount = 0;
        try {
            const inboxInfo = await gmail.users.labels.get({
                userId: 'me',
                id: 'INBOX'
            });
            unreadCount = inboxInfo.data.messagesUnread || 0;
        } catch (e) {
            console.warn('Could not fetch unread count');
        }

        return NextResponse.json({ 
            emails: detailedMessages,
            nextPageToken: listResponse.data.nextPageToken,
            resultSizeEstimate: listResponse.data.resultSizeEstimate,
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
