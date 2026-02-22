/**
 * useUser Hook
 *
 * Client-side React hook for accessing authentication state.
 * Listens to auth changes and provides user data + profile.
 *
 * Usage:
 *   const { user, profile, loading } = useUser();
 *
 * Para cerrar sesión usar signOutAction() de @/lib/supabase/sign-out
 *
 * @see AuthUser type from lib/supabase/auth.ts
 */

"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/supabase/types";

interface UseUserReturn {
  user: {
    id: string;
    email: string;
  } | null;
  profile: Profile | null;
  loading: boolean;
}

export function useUser(): UseUserReturn {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  // Ref estable: createBrowserClient ya es singleton pero evitamos
  // que un cambio de referencia re-dispare el useEffect.
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  useEffect(() => {
    let mounted = true;

    // Get initial user
    const getUser = async () => {
      try {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();

        if (!mounted) return;

        if (authUser) {
          setUser({
            id: authUser.id,
            email: authUser.email ?? "",
          });

          // Fetch profile
          const { data: profileData } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", authUser.id)
            .maybeSingle();

          if (mounted) {
            setProfile(profileData);
          }
        } else {
          setUser(null);
          setProfile(null);
        }
      } catch (error) {
        console.error("Error fetching user:", error);
        if (mounted) {
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    getUser();

    // Listen to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;

      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email ?? "",
        });

        // Fetch updated profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .maybeSingle();

        if (mounted) {
          setProfile(profileData);
        }
      } else {
        setUser(null);
        setProfile(null);
      }

      if (mounted) {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // supabase es estable (useRef), no necesita estar en deps

  return {
    user,
    profile,
    loading,
  };
}
