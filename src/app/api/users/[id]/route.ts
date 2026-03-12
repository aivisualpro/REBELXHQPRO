import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import Workspace from '@/models/Workspace';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await context.params;

        if (id === 'master-admin') {
            return NextResponse.json({
                _id: 'master-admin',
                firstName: 'Master',
                lastName: 'Admin',
                email: process.env.AUTHOR_USERNAME,
                role: 'SuperAdmin',
                department: 'Management',
                status: 'Active',
                profileImage: 'https://res.cloudinary.com/dwkq4s4rg/image/upload/v1766349101/rebelx-headquarters/assets/rebelx_favicon_new.png'
            });
        }

        // Try profileId first (secure URL), then fall back to _id (legacy/internal)
        let user = await User.findOne({ profileId: id }).lean();
        if (!user) {
            user = await User.findById(id).lean();
        }

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const session = await getServerSession(authOptions);
        const isSuperAdmin = (session?.user as any)?.role === 'SuperAdmin';
        const isOwnProfile = (session?.user as any)?.profileId === id || (session?.user as any)?.id === id || (session?.user as any)?._id === id;

        let canSeePassword = isSuperAdmin || isOwnProfile;
        let canSeeHourlyRate = isSuperAdmin || isOwnProfile;
        
        // Check if the assigned workspace explicitly grants field visibility in the 'users' sub-module
        if ((!canSeePassword || !canSeeHourlyRate) && (session?.user as any)?.workspaceId) {
            const workspace = await Workspace.findById((session?.user as any).workspaceId).lean();
            if (workspace) {
                const adminModule = workspace.modules?.find((m: any) => m.key === 'admin');
                const usersSubModule = adminModule?.subModules?.find((sm: any) => sm.key === 'users');
                if (usersSubModule && usersSubModule.enabled) {
                    const pswField = usersSubModule.fields?.find((f: any) => f.field === 'password');
                    if (!pswField || pswField.visible !== false) {
                        canSeePassword = true;
                    }
                    const rateField = usersSubModule.fields?.find((f: any) => f.field === 'hourlyRate');
                    if (!rateField || rateField.visible !== false) {
                        canSeeHourlyRate = true;
                    }
                }
            }
        }

        const { googleRefreshToken, googleAccessToken, ...userData } = user as any;
        if (!canSeePassword) delete userData.password;
        if (!canSeeHourlyRate) delete userData.hourlyRate;
        
        return NextResponse.json(userData);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await context.params;
        const body = await request.json();

        // Try profileId first, then _id
        let updatedUser = await User.findOneAndUpdate({ profileId: id }, body, { new: true, runValidators: true });
        if (!updatedUser) {
            updatedUser = await User.findByIdAndUpdate(id, body, { new: true, runValidators: true });
        }

        if (!updatedUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json(updatedUser);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await context.params;

        // Try profileId first, then _id
        let deletedUser = await User.findOneAndDelete({ profileId: id });
        if (!deletedUser) {
            deletedUser = await User.findByIdAndDelete(id);
        }

        if (!deletedUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
