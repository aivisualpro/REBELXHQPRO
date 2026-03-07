import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import dbConnect from "@/lib/mongoose";
import User from "@/models/User";

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "text" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error("Missing email or password");
                }

                // 1. Check against master admin credentials in .env
                const masterEmail = process.env.AUTHOR_USERNAME?.trim();
                const masterPassword = process.env.AUTHOR_PASSWORD?.trim();
                const inputEmail = credentials.email.trim();
                const inputPassword = credentials.password.trim();

                if (masterEmail && masterPassword && inputEmail === masterEmail && inputPassword === masterPassword) {
                    return {
                        id: "master-admin",
                        email: masterEmail,
                        name: "Super Admin",
                        role: "SuperAdmin",
                        department: "Management",
                        image: "https://res.cloudinary.com/dwkq4s4rg/image/upload/v1766349101/rebelx-headquarters/assets/rebelx_favicon_new.png"
                    };
                }

                // 2. Database check
                try {
                    await dbConnect();
                    const user = await User.findOne({ email: inputEmail });

                    if (user) {
                        if (user.password !== inputPassword) {
                            throw new Error("Invalid password");
                        }
                        if (user.status !== "Active") {
                            throw new Error("Account is inactive");
                        }
                        return {
                            id: user._id,
                            email: user.email,
                            name: `${user.firstName} ${user.lastName}`,
                            role: user.role,
                            department: user.department,
                            image: user.profileImage,
                            profileId: user.profileId || null,
                            workspaceId: user.workspaceId || null
                        };
                    }
                } catch (dbError) {
                    console.error("Database auth error:", dbError);
                    // If DB fails but user isn't master, we throw generic error
                }

                throw new Error("Invalid credentials");
            }
        }),
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID || "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        }),
    ],
    callbacks: {
        async signIn({ user, account, profile }) {
            if (account?.provider === "google") {
                try {
                    await dbConnect();
                    // Let the master admin in via Google if emails match
                    const masterEmail = process.env.AUTHOR_USERNAME?.trim();
                    if (masterEmail && user.email === masterEmail) {
                        return true;
                    }

                    // Otherwise, must exist in DB and be active
                    const dbUser = await User.findOne({ email: user.email });
                    if (!dbUser || dbUser.status !== "Active") {
                        return false;
                    }
                    // Mutate the user object so jwt callback gets the right data
                    user.id = dbUser._id.toString();
                    (user as any).role = dbUser.role;
                    (user as any).department = dbUser.department;
                    (user as any).profileId = dbUser.profileId || null;
                    (user as any).workspaceId = dbUser.workspaceId || null;
                    return true;
                } catch (error) {
                    console.error("Google verify error:", error);
                    return false;
                }
            }
            return true;
        },
        async jwt({ token, user, account }) {
            // When user first signs in, `user` object is populated
            if (user) {
                // If this was a Google login and it's the master admin
                if (account?.provider === "google" && user.email === process.env.AUTHOR_USERNAME?.trim()) {
                    token.id = "master-admin";
                    token.role = "SuperAdmin";
                    token.department = "Management";
                    token.profileId = null;
                    token.workspaceId = null;
                } else {
                    token.id = user.id;
                    token.role = (user as any).role;
                    token.department = (user as any).department;
                    token.profileId = (user as any).profileId || null;
                    token.workspaceId = (user as any).workspaceId || null;
                }
            }

            // Always refresh workspaceId from DB (so changes take effect without re-login)
            // Skip for master admin (id = "master-admin") since they're not in the DB
            if (token.id && token.id !== 'master-admin') {
                try {
                    await dbConnect();
                    const dbUser = await User.findById(token.id).select('workspaceId profileId').lean();
                    if (dbUser) {
                        token.workspaceId = (dbUser as any).workspaceId || null;
                        token.profileId = (dbUser as any).profileId || null;
                    }
                } catch {
                    // Silently fail — keep existing token value
                }
            }

            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                (session.user as any).id = token.id;
                (session.user as any).role = token.role;
                (session.user as any).department = token.department;
                (session.user as any).profileId = token.profileId || null;
                (session.user as any).workspaceId = token.workspaceId || null;
            }
            return session;
        }
    },
    pages: {
        signIn: "/login",
    },
    session: {
        strategy: "jwt",
    },
    secret: process.env.NEXTAUTH_SECRET,
};
