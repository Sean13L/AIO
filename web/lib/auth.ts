import type { AuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import EmailProvider from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import { sendVerificationRequest } from "./sendVerificationEmail";

const providers: AuthOptions["providers"] = [];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Without this, NextAuth refuses to sign a user in with Google if a
      // User row with that email already exists but has no Google Account
      // linked yet (e.g. the user's first sign-in was via the magic-link
      // provider) — it fails silently with ?error=OAuthAccountNotLinked
      // instead of linking. Safe here specifically because every provider
      // in this app already requires proving control of that exact mailbox
      // (Google's own verified email, or clicking a magic link sent to
      // it) — there's no provider in the mix with an unverified/
      // self-asserted email that this could let an attacker exploit.
      allowDangerousEmailAccountLinking: true,
    })
  );
}

providers.push(
  EmailProvider({
    // Unused — sendVerificationRequest below fully replaces the built-in
    // nodemailer transport, so this is just a placeholder satisfying the
    // provider's required type.
    server: { host: "", port: 0, auth: { user: "", pass: "" } },
    from: process.env.EMAIL_FROM ?? "onboarding@resend.dev",
    sendVerificationRequest,
  })
);

// Dev-only stand-in for real sign-in, mirroring the mockExtractSyllabus.ts /
// mockGeneratePreview.ts pattern: lets the whole auth flow (and every page
// behind it) be tested locally with no Google OAuth app and no email
// service configured. Never included in production builds.
if (process.env.NODE_ENV !== "production") {
  providers.push(
    CredentialsProvider({
      id: "dev-email",
      name: "Continue with email (dev)",
      credentials: {
        email: { label: "Email", type: "email" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim();
        if (!email) return null;

        const user = await prisma.user.upsert({
          where: { email },
          update: {},
          create: { email },
        });
        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    })
  );
}

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers,
  // CredentialsProvider requires JWT sessions in next-auth v4 (database
  // sessions aren't supported alongside it) — since the dev-mode provider
  // above is conditionally included, the whole app is pinned to "jwt" so
  // the strategy doesn't silently change between dev and production.
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as { id?: string }).id = token.sub;
      }
      return session;
    },
  },
};
