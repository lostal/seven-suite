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
import { and, eq } from "drizzle-orm";
import { timingSafeEqual } from "node:crypto";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

import { db } from "@/lib/db";
import { encryptToken } from "@/lib/auth/token-crypto";
import {
  accounts,
  profiles,
  sessions,
  userMicrosoftTokens,
  userPreferences,
  users,
  verificationTokens,
} from "@/lib/db/schema";

const ALLOWED_EMAIL_PATTERN = /^[^@\s]+@gruposiete\.es$/i;
const DEV_LOGIN_ENABLED =
  process.env.NODE_ENV !== "production" &&
  process.env.DEV_LOGIN_ENABLED === "true";

function hasValidDevPassword(password: unknown): boolean {
  const expected = process.env.DEV_LOGIN_PASSWORD;
  if (typeof password !== "string" || !expected) return false;

  const actualBuffer = Buffer.from(password);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function isAllowedEmail(email: string | null | undefined): boolean {
  return email ? ALLOWED_EMAIL_PATTERN.test(email.trim()) : false;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
    updateAge: 60 * 60,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    MicrosoftEntraID({
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      issuer: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/v2.0`,
      authorization: {
        params: {
          scope:
            "openid profile email offline_access User.Read Calendars.Read Chat.Create",
        },
      },
    }),
    ...(DEV_LOGIN_ENABLED
      ? [
          Credentials({
            id: "dev-credentials",
            name: "Dev Login",
            credentials: {
              email: { label: "Email", type: "email" },
              password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
              if (!hasValidDevPassword(credentials.password)) return null;
              const email = (credentials.email as string | undefined)?.trim();
              if (!email || !isAllowedEmail(email)) return null;

              const [user] = await db
                .select()
                .from(users)
                .where(eq(users.email, email))
                .limit(1);

              if (!user || !isAllowedEmail(user.email)) return null;
              return { id: user.id, email: user.email, name: user.name };
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ account, user }) {
      if (account?.provider === "microsoft-entra-id") {
        return isAllowedEmail(user.email);
      }
      return isAllowedEmail(user.email);
    },
    async jwt({ token, user, account, trigger }) {
      if (account && account.access_token) {
        // OAuth credentials stay server-side in userMicrosoftTokens. Never put
        // access or refresh tokens into the Auth.js session JWT.
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

      const [storedTokens] = await db
        .select({ refreshToken: userMicrosoftTokens.refreshToken })
        .from(userMicrosoftTokens)
        .where(eq(userMicrosoftTokens.userId, user.id))
        .limit(1);
      const refreshToken = encryptToken(
        account.refresh_token ?? storedTokens?.refreshToken ?? ""
      );

      await db
        .insert(userMicrosoftTokens)
        .values({
          userId: user.id,
          accessToken: encryptToken(account.access_token),
          refreshToken,
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
            accessToken: encryptToken(account.access_token),
            refreshToken,
            tokenExpiresAt: account.expires_at
              ? new Date(account.expires_at * 1000)
              : new Date(Date.now() + 3600 * 1000),
            scopes: account.scope ? account.scope.split(" ") : [],
            updatedAt: new Date(),
          },
        });

      // The custom table is the only application-owned token store. The
      // adapter's account row must not retain a second plaintext copy.
      if (account.providerAccountId) {
        await db
          .update(accounts)
          .set({ access_token: null, refresh_token: null })
          .where(
            and(
              eq(accounts.provider, account.provider),
              eq(accounts.providerAccountId, account.providerAccountId)
            )
          );
      }
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
