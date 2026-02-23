/**
 * Dashboard Layout
 *
 * Wraps all protected pages with sidebar + main content area.
 * Uses shadcn/ui SidebarProvider for collapsible sidebar state.
 * SearchProvider enables ⌘K command palette.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/supabase/auth";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout";
import type { UserRole } from "@/lib/supabase/types";
import { SearchProvider } from "@/context/search-context";
import { SkipToMain } from "@/components/skip-to-main";
import { getUserPreferences } from "@/lib/queries/preferences";
import { ThemeSync } from "@/components/providers/theme-sync";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireAuth().catch(() => null);

  if (!user) {
    redirect(ROUTES.LOGIN);
  }

  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  // Fetch user's saved theme to restore it on new sessions (incognito, new device)
  const prefs = await getUserPreferences(user.id);
  const dbTheme = prefs?.theme ?? "system";

  return (
    <SearchProvider role={(user.profile?.role ?? "employee") as UserRole}>
      <SidebarProvider defaultOpen={defaultOpen}>
        <SkipToMain />
        <ThemeSync dbTheme={dbTheme} />
        <AppSidebar role={(user.profile?.role ?? "employee") as UserRole} />
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
