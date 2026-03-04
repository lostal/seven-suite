/**
 * Mi Actividad — Redirect
 *
 * La actividad está ahora en /parking/mis-reservas y /oficinas/mis-reservas.
 * Esta ruta se mantiene como alias de compatibilidad.
 */

import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/supabase/auth";
import { ROUTES } from "@/lib/constants";

export default async function MisReservasPage() {
  const user = await requireAuth();

  if ((user.profile?.role ?? "employee") === "admin") {
    redirect(ROUTES.DASHBOARD);
  }

  redirect(ROUTES.PARKING);
}
