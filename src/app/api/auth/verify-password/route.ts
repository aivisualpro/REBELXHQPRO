import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongoose";
import User from "@/models/User";

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        
        if (!session?.user) {
            console.log('No session found');
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const { password } = await req.json();
        
        if (!password) {
            console.log('No password provided');
            return NextResponse.json(
                { error: "Password is required" },
                { status: 400 }
            );
        }

        const userId = (session.user as any).id;
        const userEmail = session.user.email?.trim();
        const inputPassword = password.trim();

        console.log('Password verification for user:', { userId, userEmail });

        // 1. Check database FIRST - this takes priority
        console.log('Checking database for user...');
        await dbConnect();
        
        // Try to find by _id first (which is the user ID from session)
        console.log('Looking up user by ID:', userId);
        let user = await User.findById(userId);
        
        // Fallback to email if ID lookup fails
        if (!user && userEmail) {
            console.log('ID lookup failed, trying email:', userEmail);
            user = await User.findOne({ email: userEmail });
        }

        // If user found in database, verify against their stored password
        if (user) {
            console.log('Found user in database:', user.email);
            console.log('Stored password length:', user.password?.length, 'Input password length:', inputPassword.length);

            if (user.password === inputPassword) {
                console.log('Database password verified successfully');
                return NextResponse.json({ success: true });
            } else {
                console.log('Database password mismatch');
                return NextResponse.json(
                    { error: "Invalid password" },
                    { status: 401 }
                );
            }
        }

        // 2. Fallback to master admin credentials (only if user NOT in database)
        console.log('User not found in database, checking master admin credentials...');
        const masterEmail = process.env.AUTHOR_USERNAME?.trim();
        const masterPassword = process.env.AUTHOR_PASSWORD?.trim();

        if (masterEmail && masterPassword && userEmail === masterEmail) {
            console.log('User matches master admin email, checking master password...');
            if (inputPassword === masterPassword) {
                console.log('Master password verified');
                return NextResponse.json({ success: true });
            } else {
                console.log('Master password mismatch');
                return NextResponse.json(
                    { error: "Invalid password" },
                    { status: 401 }
                );
            }
        }

        // User not found anywhere
        console.log('User not found in database or master credentials');
        return NextResponse.json(
            { error: "User not found" },
            { status: 404 }
        );

    } catch (error) {
        console.error("Password verification error:", error);
        return NextResponse.json(
            { error: "Failed to verify password" },
            { status: 500 }
        );
    }
}
