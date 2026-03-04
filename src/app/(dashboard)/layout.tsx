/**
 * Dashboard Layout
 *
 * Wraps all protected pages with sidebar + main content area.
 * Uses shadcn/ui SidebarProvider for collapsible sidebar state.
 * SearchProvider enables ⌘K command palette.
 */

import { cookies } from "next/headers";
import { requireAuth } from "@/lib/supabase/auth";
import { cn } from "@/lib/utils";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout";
import type { UserRole } from "@/lib/supabase/types";
import { SearchProvider } from "@/context/search-context";
import { SkipToMain } from "@/components/skip-to-main";
import { getUserPreferences } from "@/lib/queries/preferences";
import { ThemeSync } from "@/components/providers/theme-sync";
import { getResourceConfig } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireAuth();

  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  // Fetch user preferences, visitor_booking_enabled config, and spot ownership in parallel.
  // getResourceConfig usa el cache de 5 min (tag system-config) para consistencia.
  const supabase = await createClient();
  const [prefs, parkingVisitors, officeVisitors, parkingSpot, officeSpot] =
    await Promise.all([
      getUserPreferences(user.id),
      getResourceConfig("parking", "visitor_booking_enabled"),
      getResourceConfig("office", "visitor_booking_enabled"),
      supabase
        .from("spots")
        .select("id")
        .eq("assigned_to", user.id)
        .eq("resource_type", "parking")
        .eq("is_active", true)
        .maybeSingle(),
      supabase
        .from("spots")
        .select("id")
        .eq("assigned_to", user.id)
        .eq("resource_type", "office")
        .eq("is_active", true)
        .maybeSingle(),
    ]);
  const visitorBookingEnabled = parkingVisitors || officeVisitors;
  const hasParkingSpot = !!parkingSpot.data;
  const hasOfficeSpot = !!officeSpot.data;
  const dbTheme = prefs?.theme ?? "system";

  return (
    <SearchProvider
      role={(user.profile?.role ?? "employee") as UserRole}
      visitorBookingEnabled={visitorBookingEnabled}
    >
      <SidebarProvider defaultOpen={defaultOpen}>
        <SkipToMain />
        <ThemeSync dbTheme={dbTheme} />
        <AppSidebar
          role={(user.profile?.role ?? "employee") as UserRole}
          visitorBookingEnabled={visitorBookingEnabled}
          hasParkingSpot={hasParkingSpot}
          hasOfficeSpot={hasOfficeSpot}
        />
        <SidebarInset
          className={cn(
            "@container/content",
            "has-data-[layout=fixed]:h-svh",
            "peer-data-[variant=inset]:has-data-[layout=fixed]:h-[calc(100svh-(var(--spacing)*4))]"
          )}
        >
          {children}
        </SidebarInset>
      </SidebarProvider>
    </SearchProvider>
  );
}
