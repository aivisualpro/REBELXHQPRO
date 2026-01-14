import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const userId = searchParams.get('state'); // We passed user ID in 'state'

    if (!code || !userId) {
        return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/profile?error=missing_code`);
    }

    try {
        await dbConnect();
        
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            `${process.env.NEXTAUTH_URL}/api/auth/google/callback`
        );

        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Get user's Google email
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();

        // Update user in database
        const updateData: any = {
            googleConnected: true,
            googleEmail: userInfo.data.email,
            googleAccessToken: tokens.access_token,
            googleTokenExpiry: tokens.expiry_date,
        };

        // Only update refresh token if Google actually sent one
        // (Google only sends it the first time OR if prompt=consent was used)
        if (tokens.refresh_token) {
            updateData.googleRefreshToken = tokens.refresh_token;
        }

        const updatedUser = await User.findByIdAndUpdate(userId, { $set: updateData }, { new: true });
        console.log(`[Google Auth] Updated user ${userId}:`, updatedUser ? 'SUCCESS' : 'USER NOT FOUND');

        // Redirect back to profile or a success page
        return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/profile?success=google_connected`);
        
    } catch (error: any) {
        console.error('Google Auth Callback Error:', error);
        return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/profile?error=auth_failed`);
    }
}
