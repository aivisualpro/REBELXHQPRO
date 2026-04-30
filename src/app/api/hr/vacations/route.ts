import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import dbConnect from '@/lib/mongoose';
import Vacation from '@/models/Vacation';
import User from '@/models/User';
import Notification from '@/models/Notification';
import Setting from '@/models/Setting';
import { getVacationTypeConfig } from '@/constants/vacation-types';

export const dynamic = 'force-dynamic';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'info@rebelxbrandscrm.com';

function getAppUrl() {
    return process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://www.rebelxbrandscrm.com';
}

function formatDate(d: Date | string): string {
    const date = new Date(d);
    return date.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

// ─── GET: list vacations with filters ───
export async function GET(request: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const sortBy = searchParams.get('sortBy') || 'createdAt';
        const sortOrder = searchParams.get('sortOrder') === 'asc' ? 1 : -1;
        const employee = searchParams.get('employee') || '';
        const status = searchParams.get('status') || '';
        const fromDate = searchParams.get('fromDate') || '';
        const toDate = searchParams.get('toDate') || '';

        let query: any = {};
        if (employee) query.employee = employee;
        if (status) query.status = status;
        if (fromDate || toDate) {
            query.dateFrom = {};
            if (fromDate) query.dateFrom.$gte = new Date(fromDate);
            if (toDate) query.dateFrom.$lte = new Date(toDate);
        }

        const [total, vacations] = await Promise.all([
            Vacation.countDocuments(query),
            Vacation.find(query)
                .sort({ [sortBy]: sortOrder as any })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean()
        ]);

        // Summary stats
        const statusCounts = await Vacation.aggregate([
            ...(Object.keys(query).length > 0 ? [{ $match: query }] : []),
            { $group: { _id: '$status', count: { $sum: 1 }, totalDays: { $sum: '$totalDays' } } }
        ]);

        const summary = {
            pending: statusCounts.find(s => s._id === 'Pending')?.count || 0,
            approved: statusCounts.find(s => s._id === 'Approved')?.count || 0,
            rejected: statusCounts.find(s => s._id === 'Rejected')?.count || 0,
            totalDaysApproved: statusCounts.find(s => s._id === 'Approved')?.totalDays || 0,
            totalDaysPending: statusCounts.find(s => s._id === 'Pending')?.totalDays || 0,
        };

        return NextResponse.json({
            vacations,
            total,
            page,
            hasMore: page * limit < total,
            totalPages: Math.ceil(total / limit),
            summary,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// ─── POST: create vacation request + send email to approvers ───
export async function POST(request: Request) {
    try {
        await dbConnect();
        const body = await request.json();

        const entry = await Vacation.create(body) as any;
        const vtc = getVacationTypeConfig(body.vacationType);

        // Send notification emails to approvers
        try {
            const setting = await Setting.findOne({ key: 'vacationApprovers' });
            const approverEmails: string[] = setting?.value || [];

            if (approverEmails.length > 0) {
                const appUrl = getAppUrl();
                const detailLink = `${appUrl}/hr/vacations?id=${entry._id}`;

                // Send individual email per approver so links contain their identity
                for (const approverEmail of approverEmails) {
                    const approveLink = `${appUrl}/api/hr/vacations/${entry._id}/review?action=approve&reviewer=${encodeURIComponent(approverEmail)}`;
                    const rejectLink = `${appUrl}/api/hr/vacations/${entry._id}/review?action=reject&reviewer=${encodeURIComponent(approverEmail)}`;

                const htmlEmail = `
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
                            <h1 style="margin: 0; font-size: 18px; font-weight: 800; color: #ffffff; letter-spacing: 2px; text-transform: uppercase;">Vacation Request</h1>
                            <p style="margin: 4px 0 0 0; font-size: 12px; color: #a5b4fc;">New request pending your approval</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #ffffff; padding: 32px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
                            <table width="100%" cellspacing="0" cellpadding="0">
                                <tr>
                                    <td style="padding: 8px 0;"><strong style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Employee</strong></td>
                                    <td style="padding: 8px 0; font-size: 14px; color: #111827; font-weight: 600;">${body.employeeName}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; border-top: 1px solid #f3f4f6;"><strong style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Type</strong></td>
                                    <td style="padding: 8px 0; border-top: 1px solid #f3f4f6; font-size: 14px; color: #111827;"><span style="background: ${vtc.bgHex}; color: ${vtc.hex}; padding: 3px 10px; border-radius: 4px; font-weight: 700; font-size: 12px;">${vtc.emoji} ${body.vacationType}</span></td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; border-top: 1px solid #f3f4f6;"><strong style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Date From</strong></td>
                                    <td style="padding: 8px 0; border-top: 1px solid #f3f4f6; font-size: 14px; color: #111827;">${formatDate(body.dateFrom)}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; border-top: 1px solid #f3f4f6;"><strong style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Date To</strong></td>
                                    <td style="padding: 8px 0; border-top: 1px solid #f3f4f6; font-size: 14px; color: #111827;">${formatDate(body.dateTo)}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; border-top: 1px solid #f3f4f6;"><strong style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Total Days</strong></td>
                                    <td style="padding: 8px 0; border-top: 1px solid #f3f4f6; font-size: 14px; color: #111827; font-weight: 700;">${body.totalDays} day${body.totalDays > 1 ? 's' : ''}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; border-top: 1px solid #f3f4f6;"><strong style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Reason</strong></td>
                                    <td style="padding: 8px 0; border-top: 1px solid #f3f4f6; font-size: 14px; color: #111827;">${body.reason || 'N/A'}</td>
                                </tr>
                            </table>
                            <div style="margin-top: 28px; text-align: center;">
                                <a href="${approveLink}" style="display: inline-block; margin: 0 6px; padding: 12px 28px; background-color: #059669; color: #fff; text-decoration: none; font-weight: 700; font-size: 13px; border-radius: 6px; letter-spacing: 1px; text-transform: uppercase;">✓ Approve</a>
                                <a href="${rejectLink}" style="display: inline-block; margin: 0 6px; padding: 12px 28px; background-color: #dc2626; color: #fff; text-decoration: none; font-weight: 700; font-size: 13px; border-radius: 6px; letter-spacing: 1px; text-transform: uppercase;">✗ Reject</a>
                            </div>
                            <div style="margin-top: 16px; text-align: center;">
                                <a href="${detailLink}" style="font-size: 12px; color: #6366f1; text-decoration: underline;">View full details →</a>
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
                        to: [approverEmail],
                        subject: `${vtc.emoji} Vacation Request: ${body.employeeName} — ${body.vacationType} (${body.totalDays} days)`,
                        html: htmlEmail,
                    });
                }
            }
        } catch (emailErr) {
            console.error('Failed to send vacation approval email:', emailErr);
        }

        // Create in-app notification for each approver
        try {
            const setting2 = await Setting.findOne({ key: 'vacationApprovers' });
            const approvers: string[] = setting2?.value || [];
            if (approvers.length > 0) {
                await Notification.insertMany(approvers.map(email => ({
                    category: 'others',
                    title: `${vtc.emoji} Vacation Request`,
                    message: `${body.employeeName} requested ${body.vacationType} (${body.totalDays} days)`,
                    link: `/hr/vacations?id=${entry._id}`,
                    metadata: { type: 'vacation_request', vacationId: entry._id, forUser: email },
                })));
            }
        } catch {}

        return NextResponse.json(entry, { status: 201 });
    } catch (error: any) {
        console.error('Vacation create error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
