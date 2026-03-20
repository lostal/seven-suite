/**
 * Auth Callback Route
 *
 * This route previously handled Supabase OAuth redirects.
 * With Auth.js, OAuth callbacks are handled automatically by
 * the [...nextauth] API route — this route is no longer needed.
 *
 * Kept as a redirect fallback in case any external service
 * still points to this URL.
 */

import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/`);
}
