/**
 * AppSidebar Component
 *
 * Main sidebar using shadcn/ui Sidebar with data-driven navigation.
 * Filters nav items based on user role.
 * Based on shadcn-admin AppSidebar pattern.
 */

"use client";

import { useMemo } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { getSidebarData } from "./data/sidebar-data";
import { AppTitle } from "./app-title";
import { NavGroup } from "./nav-group";
import { NavUser } from "./nav-user";
import type { UserRole } from "@/lib/supabase/types";

interface AppSidebarProps {
  role: UserRole;
  visitorBookingEnabled?: boolean;
  hasParkingSpot?: boolean;
  hasOfficeSpot?: boolean;
}

export function AppSidebar({
  role,
  visitorBookingEnabled = true,
  hasParkingSpot = false,
  hasOfficeSpot = false,
}: AppSidebarProps) {
  const filteredNavGroups = useMemo(() => {
    const data = getSidebarData({
      hasParkingSpot,
      hasOfficeSpot,
      visitorBookingEnabled,
    });
    return data.navGroups
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) => !item.roles || item.roles.includes(role)
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [role, visitorBookingEnabled, hasParkingSpot, hasOfficeSpot]);

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <AppTitle />
      </SidebarHeader>
      <SidebarContent>
        {filteredNavGroups.map((props) => (
          <NavGroup key={props.title} {...props} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
