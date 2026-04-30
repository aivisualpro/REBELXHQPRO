import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import dbConnect from '@/lib/mongoose';
import Vacation from '@/models/Vacation';
import Notification from '@/models/Notification';
import { getVacationTypeConfig } from '@/constants/vacation-types';

export const dynamic = 'force-dynamic';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'info@rebelxbrandscrm.com';

function getAppUrl() {
    return process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.NEXTAUTH_URL || 'http://localhost:3000';
}

function formatDate(d: Date | string): string {
    return new Date(d).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

// GET single vacation
export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await context.params;
        const vacation = await Vacation.findById(id).lean();
        if (!vacation) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json(vacation);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PUT update vacation (handles approve/reject from app UI)
export async function PUT(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await context.params;
        const body = await request.json();
        const vacation = await Vacation.findByIdAndUpdate(id, body, { new: true }).lean() as any;
        if (!vacation) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        // If status changed to Approved/Rejected, notify the employee
        if (body.status === 'Approved' || body.status === 'Rejected') {
            const vtc = getVacationTypeConfig(vacation.vacationType);
            const statusEmoji = body.status === 'Approved' ? '✅' : '❌';
            const statusColor = body.status === 'Approved' ? '#059669' : '#dc2626';
            const reviewerName = body.reviewedByName || 'A reviewer';
            const appUrl = getAppUrl();

            // In-app notification for the employee
            try {
                await Notification.create({
                    category: 'others',
                    title: `${statusEmoji} Vacation ${body.status}`,
                    message: `Your ${vacation.vacationType} request (${vacation.totalDays} days) has been ${body.status.toLowerCase()} by ${reviewerName}.${body.reviewNote ? ` Note: "${body.reviewNote}"` : ''}`,
                    link: `/hr/vacations?id=${vacation._id}`,
                    metadata: { type: 'vacation_review', vacationId: vacation._id, forUser: vacation.employee },
                });
            } catch {}

            // Email notification to the employee
            try {
                const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;">
<tr><td style="background:linear-gradient(135deg,#1e1b4b,#312e81);padding:24px 32px;border-radius:8px 8px 0 0;">
<h1 style="margin:0;font-size:18px;font-weight:800;color:#fff;letter-spacing:2px;text-transform:uppercase;">Vacation ${body.status}</h1>
</td></tr>
<tr><td style="background:#fff;padding:32px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
<div style="text-align:center;margin-bottom:24px;">
<span style="display:inline-block;padding:10px 24px;background:${statusColor}15;border:2px solid ${statusColor};border-radius:8px;font-size:16px;font-weight:800;color:${statusColor};text-transform:uppercase;letter-spacing:2px;">${statusEmoji} ${body.status}</span>
</div>
<table width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:8px 0;"><strong style="color:#6b7280;font-size:12px;text-transform:uppercase;">Type</strong></td><td style="padding:8px 0;font-size:14px;color:#111827;"><span style="background:${vtc.bgHex};color:${vtc.hex};padding:3px 10px;border-radius:4px;font-weight:700;font-size:12px;">${vtc.emoji} ${vacation.vacationType}</span></td></tr>
<tr><td style="padding:8px 0;border-top:1px solid #f3f4f6;"><strong style="color:#6b7280;font-size:12px;text-transform:uppercase;">Dates</strong></td><td style="padding:8px 0;border-top:1px solid #f3f4f6;font-size:14px;color:#111827;">${formatDate(vacation.dateFrom)} → ${formatDate(vacation.dateTo)}</td></tr>
<tr><td style="padding:8px 0;border-top:1px solid #f3f4f6;"><strong style="color:#6b7280;font-size:12px;text-transform:uppercase;">Days</strong></td><td style="padding:8px 0;border-top:1px solid #f3f4f6;font-size:14px;color:#111827;font-weight:700;">${vacation.totalDays}</td></tr>
<tr><td style="padding:8px 0;border-top:1px solid #f3f4f6;"><strong style="color:#6b7280;font-size:12px;text-transform:uppercase;">Reviewed By</strong></td><td style="padding:8px 0;border-top:1px solid #f3f4f6;font-size:14px;color:#111827;">${reviewerName}</td></tr>
${body.reviewNote ? `<tr><td style="padding:8px 0;border-top:1px solid #f3f4f6;"><strong style="color:#6b7280;font-size:12px;text-transform:uppercase;">Note</strong></td><td style="padding:8px 0;border-top:1px solid #f3f4f6;font-size:14px;color:#111827;">${body.reviewNote}</td></tr>` : ''}
</table>
<div style="margin-top:24px;text-align:center;">
<a href="${appUrl}/hr/vacations?id=${vacation._id}" style="display:inline-block;padding:10px 24px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:13px;">View in App →</a>
</div>
</td></tr>
<tr><td style="background:#f9fafb;padding:20px 32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
<p style="margin:0;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;font-weight:700;">REBEL X Brands</p>
</td></tr>
</table></td></tr></table>
</body></html>`;

                await resend.emails.send({
                    from: `REBEL X Brands <${FROM_EMAIL}>`,
                    to: [vacation.employee],
                    subject: `${statusEmoji} Vacation ${body.status}: ${vtc.emoji} ${vacation.vacationType} (${vacation.totalDays} days) — by ${reviewerName}`,
                    html,
                });
            } catch (emailErr) {
                console.error('Failed to send vacation review email:', emailErr);
            }
        }

        return NextResponse.json(vacation);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE vacation
export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await context.params;
        const vacation = await Vacation.findByIdAndDelete(id);
        if (!vacation) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

