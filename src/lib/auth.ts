import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
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
                            image: user.profileImage
                        };
                    }
                } catch (dbError) {
                    console.error("Database auth error:", dbError);
                    // If DB fails but user isn't master, we throw generic error
                }

                throw new Error("Invalid credentials");
            }
        })
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.role = (user as any).role;
                token.department = (user as any).department;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                (session.user as any).id = token.id;
                (session.user as any).role = token.role;
                (session.user as any).department = token.department;
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
