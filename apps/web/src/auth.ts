import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authenticateCredentials } from "@/features/auth/credentials";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  providers: [
    Credentials({
      credentials: {
        username: { label: "用户名", type: "text" },
        password: { label: "密码", type: "password" }
      },
      authorize: authenticateCredentials
    })
  ],
  callbacks: {
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    }
  }
});
