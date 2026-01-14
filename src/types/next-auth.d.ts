import { DefaultSession } from "next-auth"

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      id: string
      role?: string
      department?: string
    } & DefaultSession["user"]
  }

  interface User {
    role?: string
    department?: string
    status?: string
    firstName?: string
    lastName?: string
    profileImage?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role?: string
    department?: string
  }
}
