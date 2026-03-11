/**
 * Profile Queries
 *
 * Server-side functions for reading user profile data.
 */

import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";

/**
 * Get user profiles, ordered by full name.
 * @param entityId - If provided, returns only profiles belonging to that entity.
 */
export async function getProfiles(
  entityId?: string | null
): Promise<Profile[]> {
  const supabase = await createClient();

  let query = supabase.from("profiles").select("*").order("full_name");

  if (entityId) {
    query = query.eq("entity_id", entityId);
  }

  const { data, error } = await query;

  if (error) throw new Error(`Error fetching profiles: ${error.message}`);

  return data;
}
