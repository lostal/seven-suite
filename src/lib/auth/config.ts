/**
 * Auth.js Configuration
 *
 * Configures NextAuth with:
 * - Microsoft Entra ID provider (SSO via OAuth 2.0 / OIDC)
 * - Drizzle adapter for session/account persistence
 * - JWT callbacks to embed role, entityId, fullName in the token
 * - Token storage in userMicrosoftTokens for Microsoft Graph API access
 */

import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

import { db } from "@/lib/db";
import {
  accounts,
  profiles,
  sessions,
  userMicrosoftTokens,
  userPreferences,
  users,
  verificationTokens,
} from "@/lib/db/schema";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    MicrosoftEntraID({
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      issuer: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/v2.0`,
    }),
    ...(process.env.NODE_ENV !== "production"
      ? [
          Credentials({
            id: "dev-credentials",
            name: "Dev Login",
            credentials: {
              email: { label: "Email", type: "email" },
            },
            async authorize(credentials) {
              const email = credentials.email as string;
              if (!email) return null;

              const [user] = await db
                .select()
                .from(users)
                .where(eq(users.email, email))
                .limit(1);

              if (!user) return null;
              return { id: user.id, email: user.email, name: user.name };
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ account }) {
      if (account?.provider === "microsoft-entra-id") {
        return true;
      }
      return true;
    },
    async jwt({ token, user, account, trigger }) {
      if (account && account.access_token) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at
          ? account.expires_at * 1000
          : undefined;
        token.scope = account.scope;
      }

      if (user || trigger === "update") {
        const userId = (user?.id ?? token.sub) as string;

        const [profile] = await db
          .select()
          .from(profiles)
          .where(eq(profiles.id, userId))
          .limit(1);

        if (profile) {
          token.role = profile.role;
          token.entityId = profile.entityId;
          token.fullName = profile.fullName;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.role = (token.role ?? "employee") as string;
        session.user.entityId = (token.entityId ?? null) as string | null;
        session.user.fullName = (token.fullName ?? "") as string;
      }
      return session;
    },
  },
  events: {
    async signIn({ user, account }) {
      if (!user.id || !account?.access_token) return;

      await db
        .insert(userMicrosoftTokens)
        .values({
          userId: user.id,
          accessToken: account.access_token,
          refreshToken: account.refresh_token ?? "",
          tokenExpiresAt: account.expires_at
            ? new Date(account.expires_at * 1000)
            : new Date(Date.now() + 3600 * 1000),
          scopes: account.scope ? account.scope.split(" ") : [],
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: userMicrosoftTokens.userId,
          set: {
            accessToken: account.access_token,
            refreshToken: account.refresh_token ?? "",
            tokenExpiresAt: account.expires_at
              ? new Date(account.expires_at * 1000)
              : new Date(Date.now() + 3600 * 1000),
            scopes: account.scope ? account.scope.split(" ") : [],
            updatedAt: new Date(),
          },
        });
    },
    async createUser({ user }) {
      if (!user.id) return;

      await db
        .insert(profiles)
        .values({
          id: user.id,
          email: user.email ?? "",
          fullName: user.name ?? "",
          avatarUrl: user.image,
          role: "employee",
        })
        .onConflictDoNothing();

      await db
        .insert(userPreferences)
        .values({ userId: user.id })
        .onConflictDoNothing();
    },
  },
});
