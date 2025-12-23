import { withAuth } from "next-auth/middleware";

export default withAuth({
    pages: {
        signIn: "/login",
    },
});

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api/auth (auth API routes)
         * - api (all API routes - they handle their own auth)
         * - login (login page)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico, logo.png, icon.png (public assets)
         */
        "/((?!api|login|_next/static|_next/image|favicon.ico|logo.png|icon.png).*)",
    ],
};
