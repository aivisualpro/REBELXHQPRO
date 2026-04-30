import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import dbConnect from '@/lib/mongoose';
import Vacation from '@/models/Vacation';
import Notification from '@/models/Notification';
import User from '@/models/User';
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
    const date = new Date(d);
    return date.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

// GET — email link handler (approve/reject from email)
export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await context.params;
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');
        const reviewerEmail = searchParams.get('reviewer') || '';
        const appUrl = getAppUrl();

        if (action !== 'approve' && action !== 'reject') {
            return NextResponse.redirect(`${appUrl}/hr/vacations?id=${id}`);
        }

        const vacation = await Vacation.findById(id);
        if (!vacation) {
            return new NextResponse(renderHtmlPage('Not Found', 'This vacation request no longer exists.', 'error', appUrl), {
                status: 404, headers: { 'Content-Type': 'text/html' },
            });
        }

        if (vacation.status !== 'Pending') {
            return new NextResponse(renderHtmlPage(
                'Already Reviewed',
                `This request was already <strong>${vacation.status.toLowerCase()}</strong>${vacation.reviewedByName ? ` by ${vacation.reviewedByName}` : ''}.`,
                'info', appUrl
            ), { status: 200, headers: { 'Content-Type': 'text/html' } });
        }

        // Resolve reviewer name from their email
        let reviewerName = reviewerEmail;
        if (reviewerEmail) {
            const user = await User.findOne({ email: reviewerEmail }).lean() as any;
            if (user) reviewerName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || reviewerEmail;
        }

        return new NextResponse(renderReviewPage(vacation, action, id, appUrl, reviewerEmail, reviewerName), {
            status: 200, headers: { 'Content-Type': 'text/html' },
        });
    } catch (error: any) {
        return new NextResponse(`Error: ${error.message}`, { status: 500 });
    }
}

// POST — process review form submission
export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await context.params;
        const formData = await request.formData();
        const action = formData.get('action') as string;
        const reviewerEmail = formData.get('reviewerEmail') as string || '';
        // Resolve reviewer name from DB
        let reviewerName = reviewerEmail;
        if (reviewerEmail) {
            const user = await User.findOne({ email: reviewerEmail }).lean() as any;
            if (user) reviewerName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || reviewerEmail;
        }
        const reviewNote = formData.get('reviewNote') as string || '';

        const appUrl = getAppUrl();

        const vacation = await Vacation.findById(id);
        if (!vacation) {
            return new NextResponse(renderHtmlPage('Not Found', 'This vacation request no longer exists.', 'error', appUrl), {
                status: 404, headers: { 'Content-Type': 'text/html' },
            });
        }

        if (vacation.status !== 'Pending') {
            return new NextResponse(renderHtmlPage(
                'Already Reviewed',
                `This request was already <strong>${vacation.status.toLowerCase()}</strong>.`,
                'info', appUrl
            ), { status: 200, headers: { 'Content-Type': 'text/html' } });
        }

        const newStatus = action === 'approve' ? 'Approved' : 'Rejected';

        vacation.status = newStatus;
        vacation.reviewedBy = reviewerEmail;
        vacation.reviewedByName = reviewerName;
        vacation.reviewNote = reviewNote;
        vacation.reviewedAt = new Date();
        await vacation.save();

        // In-app notification for the requesting employee
        try {
            const vtc = getVacationTypeConfig(vacation.vacationType);
            await Notification.create({
                category: 'others',
                title: `${newStatus === 'Approved' ? '✅' : '❌'} Vacation ${newStatus}`,
                message: `Your ${vtc.emoji} ${vacation.vacationType} request (${vacation.totalDays} days) has been ${newStatus.toLowerCase()} by ${reviewerName}.${reviewNote ? ` Note: ${reviewNote}` : ''}`,
                link: `/hr/vacations?id=${vacation._id}`,
                metadata: { type: 'vacation_review', vacationId: vacation._id, forUser: vacation.employee },
            });
        } catch {}

        // Email notification to the requesting employee
        try {
            const vtc = getVacationTypeConfig(vacation.vacationType);
            const statusColor = newStatus === 'Approved' ? '#059669' : '#dc2626';
            const statusIcon = newStatus === 'Approved' ? '✅' : '❌';

            const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f3f4f6;">
        <tr>
            <td align="center" style="padding: 32px 16px;">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">
                    <tr>
                        <td style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); padding: 24px 32px; border-radius: 8px 8px 0 0;">
                            <h1 style="margin: 0; font-size: 18px; font-weight: 800; color: #ffffff; letter-spacing: 2px; text-transform: uppercase;">Vacation ${newStatus}</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #ffffff; padding: 32px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
                            <div style="text-align: center; margin-bottom: 24px;">
                                <span style="display: inline-block; padding: 10px 24px; background-color: ${statusColor}15; border: 2px solid ${statusColor}; border-radius: 8px; font-size: 16px; font-weight: 800; color: ${statusColor}; text-transform: uppercase; letter-spacing: 2px;">${statusIcon} ${newStatus}</span>
                            </div>
                            <table width="100%" cellspacing="0" cellpadding="0">
                                <tr><td style="padding: 8px 0;"><strong style="color: #6b7280; font-size: 12px; text-transform: uppercase;">Type</strong></td><td style="padding: 8px 0; font-size: 14px; color: #111827;"><span style="background: ${vtc.bgHex}; color: ${vtc.hex}; padding: 3px 10px; border-radius: 4px; font-weight: 700; font-size: 12px;">${vtc.emoji} ${vacation.vacationType}</span></td></tr>
                                <tr><td style="padding: 8px 0; border-top: 1px solid #f3f4f6;"><strong style="color: #6b7280; font-size: 12px; text-transform: uppercase;">Dates</strong></td><td style="padding: 8px 0; border-top: 1px solid #f3f4f6; font-size: 14px; color: #111827;">${formatDate(vacation.dateFrom)} → ${formatDate(vacation.dateTo)}</td></tr>
                                <tr><td style="padding: 8px 0; border-top: 1px solid #f3f4f6;"><strong style="color: #6b7280; font-size: 12px; text-transform: uppercase;">Days</strong></td><td style="padding: 8px 0; border-top: 1px solid #f3f4f6; font-size: 14px; color: #111827; font-weight: 700;">${vacation.totalDays}</td></tr>
                                <tr><td style="padding: 8px 0; border-top: 1px solid #f3f4f6;"><strong style="color: #6b7280; font-size: 12px; text-transform: uppercase;">Reviewed By</strong></td><td style="padding: 8px 0; border-top: 1px solid #f3f4f6; font-size: 14px; color: #111827;">${reviewerName}</td></tr>
                                ${reviewNote ? `<tr><td style="padding: 8px 0; border-top: 1px solid #f3f4f6;"><strong style="color: #6b7280; font-size: 12px; text-transform: uppercase;">Note</strong></td><td style="padding: 8px 0; border-top: 1px solid #f3f4f6; font-size: 14px; color: #111827;">${reviewNote}</td></tr>` : ''}
                            </table>
                            <div style="margin-top: 24px; text-align: center;">
                                <a href="${appUrl}/hr/vacations?id=${vacation._id}" style="display: inline-block; padding: 10px 24px; background: #4f46e5; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 13px;">View in App →</a>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #f9fafb; padding: 20px 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                            <p style="margin: 0; font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">REBEL X Brands</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

            await resend.emails.send({
                from: `REBEL X Brands <${FROM_EMAIL}>`,
                to: [vacation.employee],
                subject: `${statusIcon} Vacation ${newStatus}: ${vtc.emoji} ${vacation.vacationType} (${vacation.totalDays} days) — by ${reviewerName}`,
                html,
            });
        } catch (emailErr) {
            console.error('Failed to send review notification email:', emailErr);
        }

        return new NextResponse(renderHtmlPage(
            `Request ${newStatus}`,
            `The vacation request has been <strong>${newStatus.toLowerCase()}</strong> successfully.${reviewNote ? ` Your note: "${reviewNote}"` : ''}`,
            newStatus === 'Approved' ? 'success' : 'error',
            appUrl
        ), { status: 200, headers: { 'Content-Type': 'text/html' } });
    } catch (error: any) {
        return new NextResponse(`Error: ${error.message}`, { status: 500 });
    }
}

// ─── HTML Renderers ───

function renderHtmlPage(title: string, body: string, type: 'success' | 'error' | 'info', appUrl: string) {
    const colors = {
        success: { bg: '#ecfdf5', border: '#059669', text: '#065f46', icon: '✅' },
        error: { bg: '#fef2f2', border: '#dc2626', text: '#991b1b', icon: '❌' },
        info: { bg: '#eff6ff', border: '#3b82f6', text: '#1e40af', icon: 'ℹ️' },
    }[type];

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;">
<div style="max-width:500px;width:90%;background:#fff;border-radius:12px;padding:40px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
<div style="font-size:48px;margin-bottom:16px;">${colors.icon}</div>
<h1 style="margin:0 0 12px;font-size:24px;color:#111827;">${title}</h1>
<p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">${body}</p>
<a href="${appUrl}/hr/vacations" style="display:inline-block;padding:10px 24px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:13px;">Go to Vacations →</a>
</div></body></html>`;
}

function renderReviewPage(vacation: any, action: string, id: string, appUrl: string, reviewerEmail: string, reviewerName: string) {
    const isApprove = action === 'approve';
    const color = isApprove ? '#059669' : '#dc2626';
    const label = isApprove ? 'Approve' : 'Reject';

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${label} Vacation Request</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:16px}
.card{max-width:520px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)}
.header{background:linear-gradient(135deg,#1e1b4b,#312e81);padding:24px 32px;color:#fff}
.body{padding:32px}.row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:14px}
.row-label{color:#6b7280;font-size:12px;text-transform:uppercase;font-weight:700;letter-spacing:1px}
.row-value{color:#111827;font-weight:600}
.reviewer-badge{margin-top:20px;padding:12px 16px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;display:flex;align-items:center;gap:10px}
.reviewer-badge .icon{width:32px;height:32px;border-radius:50%;background:#6366f1;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px}
.reviewer-badge .info{font-size:13px;color:#1e293b;font-weight:600}
.reviewer-badge .email{font-size:11px;color:#64748b;font-weight:400}
.form-group{margin-top:20px}.form-group label{display:block;font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px}
.form-group textarea{width:100%;padding:10px 14px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;font-family:inherit;resize:vertical;min-height:80px}
.submit{margin-top:24px;width:100%;padding:14px;border:none;border-radius:8px;font-size:14px;font-weight:800;color:#fff;text-transform:uppercase;letter-spacing:2px;cursor:pointer;background:${color}}
.submit:hover{opacity:0.9}
</style></head>
<body>
<div class="card">
<div class="header">
<h1 style="font-size:18px;font-weight:800;letter-spacing:2px;text-transform:uppercase">${label} Vacation Request</h1>
<p style="font-size:12px;color:#a5b4fc;margin-top:4px">${vacation.employeeName}</p>
</div>
<div class="body">
<div class="row"><span class="row-label">Type</span><span class="row-value">${vacation.vacationType}</span></div>
<div class="row"><span class="row-label">From</span><span class="row-value">${formatDate(vacation.dateFrom)}</span></div>
<div class="row"><span class="row-label">To</span><span class="row-value">${formatDate(vacation.dateTo)}</span></div>
<div class="row"><span class="row-label">Days</span><span class="row-value">${vacation.totalDays}</span></div>
<div class="row"><span class="row-label">Reason</span><span class="row-value">${vacation.reason || 'N/A'}</span></div>
<div class="reviewer-badge">
<div class="icon">${reviewerName.charAt(0).toUpperCase()}</div>
<div><div class="info">${reviewerName}</div><div class="email">${reviewerEmail}</div></div>
</div>
<form method="POST" action="${appUrl}/api/hr/vacations/${id}/review">
<input type="hidden" name="action" value="${action}">
<input type="hidden" name="reviewerEmail" value="${reviewerEmail}">
<div class="form-group">
<label>Note (optional)</label>
<textarea name="reviewNote" placeholder="Add a note for the employee..."></textarea>
</div>
<button type="submit" class="submit">${isApprove ? '✓' : '✗'} ${label} Request</button>
</form>
</div>
</div>
</body></html>`;
}
