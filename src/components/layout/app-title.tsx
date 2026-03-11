/**
 * AppTitle Component
 *
 * Sidebar header with GRUPOSIETE branding and logo.
 * Based on shadcn-admin AppTitle pattern.
 */

"use client";

import Link from "next/link";
import Image from "next/image";
import { ROUTES } from "@/lib/constants";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

export function AppTitle({ entityName }: { entityName?: string }) {
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          className="gap-0 py-0 hover:bg-transparent active:bg-transparent"
          asChild
        >
          <Link
            href={ROUTES.DASHBOARD}
            onClick={() => setOpenMobile(false)}
            className="flex items-center gap-2"
          >
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg">
              <Image
                src="/favicon-512x512.png"
                alt="GRUPOSIETE Reservas"
                width={32}
                height={32}
                className="size-8 rounded-lg"
              />
            </div>
            <div className="grid flex-1 text-start text-sm leading-tight">
              <span className="truncate font-bold">GRUPOSIETE</span>
              <span className="truncate text-xs">
                {entityName ?? "Reservas"}
              </span>
            </div>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
