/**
 * Mi Actividad — Redirect
 *
 * La actividad está ahora en /parking/mis-reservas y /oficinas/mis-reservas.
 * Esta ruta se mantiene como alias de compatibilidad.
 */

import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/helpers";
import { ROUTES } from "@/lib/constants";

export default async function MisReservasPage() {
  await requireAuth();

  redirect(ROUTES.PARKING);
}
