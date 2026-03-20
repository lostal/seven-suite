/**
 * useUser Hook
 *
 * Client-side React hook for accessing authentication state.
 * Wraps next-auth/react useSession() and exposes the same
 * { user, profile, loading } interface for backwards compatibility.
 *
 * Usage:
 *   const { user, profile, loading } = useUser();
 *
 * Para cerrar sesión usar signOutAction() de @/lib/auth/sign-out
 */

"use client";

import { useSession } from "next-auth/react";

interface UseUserProfile {
  id: string;
  email: string;
  fullName: string;
  role: string | null;
  entityId: string | null;
}

interface UseUserReturn {
  user: {
    id: string;
    email: string;
  } | null;
  profile: UseUserProfile | null;
  loading: boolean;
}

export function useUser(): UseUserReturn {
  const { data: session, status } = useSession();

  const loading = status === "loading";

  if (!session?.user) {
    return { user: null, profile: null, loading };
  }

  const { id, email, fullName, role, entityId } = session.user as {
    id: string;
    email: string;
    fullName: string;
    role: string | null;
    entityId: string | null;
  };

  return {
    user: { id, email: email ?? "" },
    profile: {
      id,
      email: email ?? "",
      fullName: fullName ?? "",
      role: role ?? null,
      entityId: entityId ?? null,
    },
    loading,
  };
}
