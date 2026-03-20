/**
 * Auth.js Configuration
 *
 * Configures NextAuth with:
 * - Credentials provider (email/password with bcrypt)
 * - Drizzle adapter for session/account persistence
 * - JWT callbacks to embed role, entityId, fullName in the token
 *
 * Microsoft Entra ID will be added in a future iteration.
 */

import { DrizzleAdapter } from "@auth/drizzle-adapter";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { db } from "@/lib/db";
import { profiles, userPreferences, users } from "@/lib/db/schema";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email as string;
        const password = credentials.password as string;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user?.password) return null;

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      // On initial sign-in or when update is triggered, embed profile data
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
    async createUser({ user }) {
      if (!user.id) return;

      // Create profile for new user (replaces Supabase handle_new_user trigger)
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

      // Create default preferences
      await db
        .insert(userPreferences)
        .values({ userId: user.id })
        .onConflictDoNothing();
    },
  },
});
