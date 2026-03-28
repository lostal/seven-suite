"use server";

/**
 * Sign Out Server Actions
 */

import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/constants";

import { signOut } from "./config";

/** Cierra la sesión actual */
export async function signOutAction() {
  await signOut({ redirect: false });
  redirect(ROUTES.LOGIN);
}
