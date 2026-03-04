/**
 * Search Context
 *
 * Provides open/close state for the command menu.
 * Handles ⌘K / Ctrl+K keyboard shortcut.
 */

"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { CommandMenu } from "@/components/command-menu";
import type { UserRole } from "@/lib/supabase/types";

type SearchContextType = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  role: UserRole;
  visitorBookingEnabled: boolean;
};

const SearchContext = createContext<SearchContextType | null>(null);

type SearchProviderProps = {
  children: React.ReactNode;
  role: UserRole;
  visitorBookingEnabled?: boolean;
};

export function SearchProvider({
  children,
  role,
  visitorBookingEnabled = true,
}: SearchProviderProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <SearchContext value={{ open, setOpen, role, visitorBookingEnabled }}>
      {children}
      <CommandMenu />
    </SearchContext>
  );
}

export function useSearch() {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error("useSearch must be used within a SearchProvider");
  }
  return context;
}
