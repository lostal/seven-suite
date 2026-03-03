/**
 * Queries de Cesiones
 *
 * Funciones de servidor para leer datos de cesiones.
 */

import { createClient } from "@/lib/supabase/server";
import type { Cession } from "@/lib/supabase/types";

/** Tipo interno para la query con joins de plaza y perfil */
type CessionJoin = Cession & {
  spots: { label: string; resource_type: string } | null;
  profiles: { full_name: string } | null;
};

/** Fila de cesión con etiqueta de plaza, nombre de usuario y tipo de recurso */
export interface CessionWithDetails extends Cession {
  spot_label: string;
  user_name: string;
  resource_type: "parking" | "office";
}

/**
 * Obtiene todas las cesiones no canceladas para una fecha específica,
 * con detalles de plaza y usuario.
 *
 * @param resourceType - Si se proporciona, filtra por tipo de recurso ('parking' | 'office').
 */
export async function getCessionsByDate(
  date: string,
  resourceType?: "parking" | "office"
): Promise<CessionWithDetails[]> {
  const supabase = await createClient();

  let query = supabase
    .from("cessions")
    .select(
      "*, spots!cessions_spot_id_fkey(label, resource_type), profiles!cessions_user_id_fkey(full_name)"
    )
    .eq("date", date)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });

  if (resourceType) {
    query = query.eq("spots.resource_type", resourceType);
  }

  const { data, error } = await query.returns<CessionJoin[]>();

  if (error) throw new Error(`Error al obtener cesiones: ${error.message}`);

  return data
    .filter((c) => c.spots !== null)
    .map(
      (c): CessionWithDetails => ({
        id: c.id,
        spot_id: c.spot_id,
        user_id: c.user_id,
        date: c.date,
        status: c.status,
        created_at: c.created_at,
        spot_label: c.spots!.label,
        user_name: c.profiles?.full_name ?? "",
        resource_type: c.spots!.resource_type as "parking" | "office",
      })
    );
}

/**
 * Obtiene las cesiones no canceladas futuras de un usuario.
 * Devuelve cesiones desde hoy en adelante, ordenadas por fecha.
 * Si se proporciona resourceType, filtra en SQL las cesiones de ese módulo.
 */
export async function getUserCessions(
  userId: string,
  resourceType?: "parking" | "office"
): Promise<CessionWithDetails[]> {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0]!;

  let query = supabase
    .from("cessions")
    .select(
      "*, spots!cessions_spot_id_fkey(label, resource_type), profiles!cessions_user_id_fkey(full_name)"
    )
    .eq("user_id", userId)
    .neq("status", "cancelled")
    .gte("date", today)
    .order("date");

  if (resourceType) {
    query = query.eq("spots.resource_type", resourceType);
  }

  const { data, error } = await query.returns<CessionJoin[]>();

  if (error)
    throw new Error(`Error al obtener cesiones del usuario: ${error.message}`);

  return data
    .filter((c) => c.spots !== null)
    .map(
      (c): CessionWithDetails => ({
        id: c.id,
        spot_id: c.spot_id,
        user_id: c.user_id,
        date: c.date,
        status: c.status,
        created_at: c.created_at,
        spot_label: c.spots!.label,
        user_name: c.profiles?.full_name ?? "",
        resource_type: c.spots!.resource_type as "parking" | "office",
      })
    );
}
