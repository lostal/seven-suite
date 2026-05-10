"use server";

/**
 * Sign Out Server Actions
 */

import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/constants";

import { signOut } from "./config";
import { clearActiveEntityCookie } from "@/components/layout/entity-switcher-actions";

/** Cierra la sesión actual y limpia la cookie de sede activa */
export async function signOutAction() {
  await clearActiveEntityCookie();
  await signOut({ redirect: false });
  redirect(ROUTES.LOGIN);
}
