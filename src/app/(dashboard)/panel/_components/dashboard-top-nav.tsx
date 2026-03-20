/**
 * DashboardTopNav
 *
 * Client component wrapper for the TopNav used in the dashboard header.
 * Needed because usePathname() requires "use client".
 */

"use client";

import { usePathname } from "next/navigation";
import { ROUTES } from "@/lib/constants";
import { TopNav } from "@/components/layout";
import type { UserRole } from "@/lib/db/types";

const linksByRole: Record<string, { title: string; href: string }[]> = {
  employee: [
    { title: "Dashboard", href: ROUTES.DASHBOARD },
    { title: "Reservas", href: ROUTES.PARKING },
    { title: "Mapa", href: ROUTES.PARKING_MAP },
    { title: "Visitantes", href: ROUTES.VISITORS },
  ],
  admin: [
    { title: "Dashboard", href: ROUTES.DASHBOARD },
    { title: "Visitantes", href: ROUTES.VISITORS },
    { title: "Asignaciones", href: ROUTES.ADMIN_PARKING },
    { title: "Configuración", href: ROUTES.ADMIN_SETTINGS },
  ],
};

interface DashboardTopNavProps {
  role: UserRole;
}

export function DashboardTopNav({ role }: DashboardTopNavProps) {
  const pathname = usePathname();
  const links = linksByRole[role] ?? linksByRole.employee!;
  return (
    <TopNav
      links={links.map((link) => ({
        ...link,
        isActive: pathname === link.href,
      }))}
    />
  );
}
