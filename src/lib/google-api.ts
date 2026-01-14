import { google } from 'googleapis';
import User from '@/models/User';
import dbConnect from './mongoose';

export async function getGmailClient(userId: string) {
    await dbConnect();
    const user = await User.findById(userId);

    if (!user || !user.googleConnected || !user.googleRefreshToken) {
        throw new Error('Google account not connected or refresh token missing');
    }

    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        `${process.env.NEXTAUTH_URL}/api/auth/google/callback`
    );

    oauth2Client.setCredentials({
        refresh_token: user.googleRefreshToken,
        access_token: user.googleAccessToken,
        expiry_date: user.googleTokenExpiry
    });

    // Check if access token is expired or will expire in 5 minutes
    const now = Date.now();
    if (!user.googleTokenExpiry || user.googleTokenExpiry < now + 300000) {
        try {
            const { credentials } = await oauth2Client.refreshAccessToken();
            
            // Update user with new credentials
            user.googleAccessToken = credentials.access_token!;
            user.googleTokenExpiry = credentials.expiry_date!;
            if (credentials.refresh_token) {
                user.googleRefreshToken = credentials.refresh_token;
            }
            await user.save();
        } catch (error) {
            console.error('Error refreshing Google token:', error);
            throw new Error('Failed to refresh Google token');
        }
    }

    return google.gmail({ version: 'v1', auth: oauth2Client });
}
