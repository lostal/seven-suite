/**
 * Environment variable validation
 *
 * Validates all required env vars at build/startup time using Zod.
 * Import this where needed — fails fast with clear error messages.
 *
 * @see https://zod.dev
 */

import { z } from "zod/v4";

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1),

  // Auth.js
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),

  // Microsoft Entra ID (SSO obligatorio)
  MICROSOFT_CLIENT_ID: z.string().min(1),
  MICROSOFT_CLIENT_SECRET: z.string().min(1),
  MICROSOFT_TENANT_ID: z.string().min(1),

  // Resend (opcional)
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM_EMAIL: z.email().optional(),

  // App
  NEXT_PUBLIC_APP_URL: z.url().optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validate environment variables.
 * Call this in instrumentation.ts or root layout to fail fast.
 */
export function validateEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error(
      "❌ Invalid environment variables:",
      z.prettifyError(parsed.error)
    );
    throw new Error("Invalid environment variables");
  }

  return parsed.data;
}
