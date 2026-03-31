import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import dbConnect from '@/lib/mongoose';
import OrderEmail from '@/models/OrderEmail';
import SaleOrder from '@/models/SaleOrder';
import User from '@/models/User';
import { generatePdfFromTemplate } from '@/lib/google-docs';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'info@rebelxbrandscrm.com';
const TEMPLATE_ID = '1wAtench6ZMQOyaBiQvfxuVMgkBMBSc0lLnRp5g4Cv1Y';

// GET - Fetch all emails for an order
export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await context.params;

        const emails = await OrderEmail.find({ orderId: id })
            .sort({ sentAt: -1 })
            .lean();

        return NextResponse.json({ emails });
    } catch (error: any) {
        console.error('Error fetching order emails:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// ─── Background processor: generates PDF, sends via Resend, updates the record ───
export async function processEmailInBackground(emailRecordId: string, orderId: string, payload: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    htmlBody?: string;
    textBody?: string;
    attachPdf: boolean;
    orderLabel?: string;
}) {
    try {
        await dbConnect();

        const attachments: { filename: string; content: Buffer }[] = [];
        let attachmentName = '';

        if (payload.attachPdf) {
            void User; // register model

            const order = await SaleOrder.findById(orderId)
                .populate('clientId', 'name addresses')
                .populate('lineItems.sku', 'name')
                .populate('salesRep', 'firstName lastName email')
                .lean() as any;

            if (!order) {
                await OrderEmail.findByIdAndUpdate(emailRecordId, {
                    status: 'failed',
                    errorMessage: 'Order not found during PDF generation',
                });
                return;
            }

            const formatCurrency = (val: number) =>
                '$' + (val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

            const shippingAddr = [order.shippingAddress, order.city, order.state].filter(Boolean).join(', ');
            const clientName = typeof order.clientId === 'object' && order.clientId ? order.clientId.name || '' : '';

            let salesRepName = '';
            if (typeof order.salesRep === 'object' && order.salesRep !== null) {
                salesRepName = `${order.salesRep.firstName || ''} ${order.salesRep.lastName || ''}`.trim();
                if (!salesRepName) salesRepName = order.salesRep.email || '';
            } else if (typeof order.salesRep === 'string') {
                salesRepName = order.salesRep;
            }

            const subtotal = (order.lineItems || []).reduce((sum: number, item: any) => sum + ((item.qtyShipped || 0) * (item.price || 0)), 0);
            const discount = order.discount || 0;
            const tax = order.tax || 0;
            const shippingCost = order.shippingCost || 0;
            const grandTotal = subtotal + shippingCost + tax - discount;
            const amountPaid = (order.payments || []).reduce((sum: number, p: any) => sum + (p.paymentAmount || 0), 0);
            const totalBalance = grandTotal - amountPaid;

            const replacements: Record<string, string> = {
                '{{label}}': order.label || '',
                '{{date}}': formatDate(order.createdAt),
                '{{clientId.name}}': clientName,
                '{{shippingAddress}}': shippingAddr || '-',
                '{{salesRep.name}}': salesRepName,
                '{{paymentMethod}}': order.paymentMethod || '-',
                '{{shippingMethod}}': order.shippingMethod || '-',
                '{{shippingDate}}': formatDate(order.shippedDate),
                '{{Totalsubtotal}}': formatCurrency(subtotal),
                '{{Totaldiscount}}': formatCurrency(discount),
                '{{Totaltax}}': formatCurrency(tax),
                '{{TotalshippingCost}}': formatCurrency(shippingCost),
                '{{TotalGrandTotal}}': formatCurrency(grandTotal),
                '{{AmountPaid}}': formatCurrency(amountPaid),
                '{{TotalBalance}}': formatCurrency(totalBalance),
            };

            const tableRows = (order.lineItems || []).map((item: any) => {
                const skuName = typeof item.sku === 'object' && item.sku ? item.sku.name || '' : '';
                return {
                    '{{lineItems.sku.name}}': skuName,
                    '{{lineItems.productDescription}}': item.productDescription || '',
                    '{{lineItems.lotNumber}}': item.lotNumber || '',
                    '{{lineItems.qtyShipped}}': String(item.qtyShipped || 0),
                    '{{lineItems.uom}}': item.uom || '',
                    '{{lineItems.price}}': formatCurrency(item.price || 0),
                    '{{lineItems.total}}': formatCurrency((item.qtyShipped || 0) * (item.price || 0)),
                };
            });

            const pdfBuffer = await generatePdfFromTemplate(TEMPLATE_ID, replacements, tableRows);
            attachmentName = `${order.label || 'SaleOrder'}.pdf`;

            attachments.push({
                filename: attachmentName,
                content: Buffer.from(pdfBuffer),
            });
        }

        // Build professional branded HTML email
        const bodyHtml = (payload.textBody || '').split('\n').map((line: string) => {
            if (!line.trim()) return '<br/>';
            return `<p style="margin: 0 0 8px 0; font-size: 14px; line-height: 1.7; color: #374151;">${line}</p>`;
        }).join('');

        const brandedHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f3f4f6;">
        <tr>
            <td align="center" style="padding: 32px 16px;">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); padding: 24px 32px; border-radius: 8px 8px 0 0;">
                            <h1 style="margin: 0; font-size: 18px; font-weight: 800; color: #ffffff; letter-spacing: 2px; text-transform: uppercase;">REBEL X Brands</h1>
                        </td>
                    </tr>
                    <!-- Body -->
                    <tr>
                        <td style="background-color: #ffffff; padding: 32px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
                            ${bodyHtml}
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f9fafb; padding: 20px 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                            <p style="margin: 0 0 4px 0; font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">REBEL X Brands</p>
                            <p style="margin: 0; font-size: 11px; color: #9ca3af;">info@rebelxbrandscrm.com</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

        // Send email via Resend
        const emailPayload: any = {
            from: `REBEL X Brands <${FROM_EMAIL}>`,
            to: payload.to,
            subject: payload.subject,
            html: brandedHtml,
            text: payload.textBody || '',
        };

        if (payload.cc && payload.cc.length > 0) emailPayload.cc = payload.cc;
        if (payload.bcc && payload.bcc.length > 0) emailPayload.bcc = payload.bcc;
        if (attachments.length > 0) emailPayload.attachments = attachments;

        const result = await resend.emails.send(emailPayload);

        if (result.error) {
            await OrderEmail.findByIdAndUpdate(emailRecordId, {
                status: 'failed',
                errorMessage: result.error.message,
            });
            console.error(`[Email ${emailRecordId}] Resend failed:`, result.error.message);
            return;
        }

        // Update record to sent with Resend ID
        await OrderEmail.findByIdAndUpdate(emailRecordId, {
            status: 'sent',
            resendId: result.data?.id,
            hasAttachment: attachments.length > 0,
            attachmentName: attachmentName || undefined,
        });

        console.log(`[Email ${emailRecordId}] Sent successfully via Resend (${result.data?.id})`);
    } catch (error: any) {
        console.error(`[Email ${emailRecordId}] Background processing failed:`, error);
        try {
            await OrderEmail.findByIdAndUpdate(emailRecordId, {
                status: 'failed',
                errorMessage: error.message || 'Background processing failed',
            });
        } catch { /* swallow update error */ }
    }
}

// POST - Queue email instantly (fire-and-forget), process in background
export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await context.params;
        const body = await request.json();
        const { to, cc, bcc, subject, htmlBody, textBody, attachPdf, sentBy } = body;

        if (!to || !Array.isArray(to) || to.length === 0) {
            return NextResponse.json({ error: 'At least one recipient is required' }, { status: 400 });
        }
        if (!subject) {
            return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
        }

        // ⚡ Step 1: Create the email record INSTANTLY with "queued" status
        const emailRecord = await OrderEmail.create({
            orderId: id,
            from: FROM_EMAIL,
            to,
            cc: cc || [],
            bcc: bcc || [],
            subject,
            body: htmlBody || textBody || '',
            bodyText: textBody || '',
            hasAttachment: !!attachPdf,
            attachmentName: attachPdf ? `${body.orderLabel || 'SaleOrder'}.pdf` : undefined,
            status: 'queued',
            sentBy,
        });

        // ⚡ Step 2: Return IMMEDIATELY — don't await the heavy work
        const response = NextResponse.json({
            success: true,
            email: emailRecord.toObject(),
        });

        // ⚡ Step 3: Fire-and-forget — kick off background processing
        // This runs AFTER the response is sent back to the client
        processEmailInBackground(emailRecord._id.toString(), id, {
            to,
            cc: cc || [],
            bcc: bcc || [],
            subject,
            htmlBody,
            textBody,
            attachPdf: !!attachPdf,
            orderLabel: body.orderLabel,
        }).catch(err => console.error('Background email error:', err));

        return response;
    } catch (error: any) {
        console.error('Error queuing email:', error);
        return NextResponse.json({ error: error.message || 'Failed to queue email' }, { status: 500 });
    }
}
