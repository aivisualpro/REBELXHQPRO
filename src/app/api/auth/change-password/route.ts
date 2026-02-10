import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongoose";
import User from "@/models/User";

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        
        if (!session?.user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const { currentPassword, newPassword } = await req.json();
        
        if (!currentPassword || !newPassword) {
            return NextResponse.json(
                { error: "Current password and new password are required" },
                { status: 400 }
            );
        }

        if (newPassword.length < 6) {
            return NextResponse.json(
                { error: "New password must be at least 6 characters" },
                { status: 400 }
            );
        }

        if (currentPassword === newPassword) {
            return NextResponse.json(
                { error: "New password must be different from current password" },
                { status: 400 }
            );
        }

        const userId = (session.user as any).id;
        const userEmail = session.user.email?.trim();

        await dbConnect();
        
        // Find the user
        let user = await User.findById(userId);
        if (!user && userEmail) {
            user = await User.findOne({ email: userEmail });
        }

        if (!user) {
            // Check if this is the master admin
            const masterEmail = process.env.AUTHOR_USERNAME?.trim();
            if (masterEmail && userEmail === masterEmail) {
                return NextResponse.json(
                    { error: "Master admin password cannot be changed from the profile page" },
                    { status: 403 }
                );
            }
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 }
            );
        }

        // Verify current password
        if (user.password !== currentPassword.trim()) {
            return NextResponse.json(
                { error: "Current password is incorrect" },
                { status: 401 }
            );
        }

        // Update the password
        user.password = newPassword.trim();
        await user.save();

        return NextResponse.json({ success: true, message: "Password updated successfully" });

    } catch (error) {
        console.error("Password change error:", error);
        return NextResponse.json(
            { error: "Failed to change password" },
            { status: 500 }
        );
    }
}
