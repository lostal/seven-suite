/**
 * Sidebar Navigation Data
 *
 * Defines the navigation structure for the app sidebar.
 * Items are grouped by section and support icons, badges, and sub-items.
 *
 * Role hierarchy: employee → hr → manager → admin
 * Each level can do everything the previous can plus new capabilities.
 *
 * Estructura de grupos:
 *   "Sede activa"  → Contenido que varía según la sede seleccionada (módulos habilitados)
 *   "General"       → Directorio, Sedes, Ajustes
 */

import {
  LayoutDashboard,
  Users,
  Settings,
  LayoutGrid,
  Building2,
  ParkingCircle,
  ArrowLeftRight,
  CalendarCheck,
  BookUser,
  Landmark,
  Palmtree,
  ClipboardList,
  Megaphone,
  User,
  Bell,
  Cloud,
  Shield,
  Palette,
  Globe,
  Car,
} from "lucide-react";
import { ROUTES } from "@/lib/constants";
import { type SidebarData } from "../types";
import type { UserRole } from "@/lib/db/types";

interface SidebarDataParams {
  hasParkingSpot: boolean;
  hasOfficeSpot: boolean;
  /** List of enabled module keys for the active/assigned entity. */
  enabledModules?: string[];
  /** Unread announcement count for the current user — shown as badge on Tablón. */
  unreadAnnouncementsCount?: number;
}

export function getSidebarData({
  hasParkingSpot,
  hasOfficeSpot,
  enabledModules,
  unreadAnnouncementsCount = 0,
}: SidebarDataParams): SidebarData {
  const parkingEnabled = !enabledModules || enabledModules.includes("parking");
  const officeEnabled = !enabledModules || enabledModules.includes("office");
  const vacacionesEnabled =
    !enabledModules || enabledModules.includes("vacaciones");
  const tablonEnabled = !enabledModules || enabledModules.includes("tablon");
  const visitorsEnabled =
    parkingEnabled && (!enabledModules || enabledModules.includes("visitors"));

  const tablonBadge =
    unreadAnnouncementsCount > 0 ? String(unreadAnnouncementsCount) : undefined;

  // ─── Subitems para empleado/hr ────────────────────────────
  const parkingSubItems = [
    hasParkingSpot
      ? {
          title: "Cesiones",
          url: ROUTES.PARKING_CESSIONS,
          icon: ArrowLeftRight,
        }
      : {
          title: "Reservas",
          url: ROUTES.PARKING_RESERVAS,
          icon: CalendarCheck,
        },
    ...(visitorsEnabled
      ? [{ title: "Visitantes", url: ROUTES.VISITORS, icon: Users }]
      : []),
  ];

  const oficinasSubItems = [
    hasOfficeSpot
      ? {
          title: "Cesiones",
          url: ROUTES.OFFICES_CESSIONS,
          icon: ArrowLeftRight,
        }
      : {
          title: "Reservas",
          url: ROUTES.OFFICES_RESERVAS,
          icon: CalendarCheck,
        },
  ];

  // ─── Subitems para manager/admin (heredan los de empleado + asignaciones) ──
  const managerParkingItems = [
    ...parkingSubItems,
    { title: "Asignaciones", url: ROUTES.ADMIN_PARKING, icon: LayoutGrid },
  ];

  const managerOficinaItems = [
    ...oficinasSubItems,
    { title: "Asignaciones", url: ROUTES.ADMIN_OFFICES, icon: LayoutGrid },
  ];

  const settingsBase = [
    { title: "Perfil", url: "/ajustes/perfil", icon: User },
    {
      title: "Notificaciones",
      url: "/ajustes/notificaciones",
      icon: Bell,
    },
    {
      title: "Apariencia",
      url: "/ajustes/apariencia",
      icon: Palette,
    },
    {
      title: "Microsoft 365",
      url: "/ajustes/microsoft",
      icon: Cloud,
    },
    { title: "Seguridad", url: "/ajustes/seguridad", icon: Shield },
  ];

  return {
    navGroups: [
      // ─── Sede activa ──────────────────────────────────────
      {
        title: "Sede activa",
        items: [
          // Panel — todos los roles
          {
            title: "Panel",
            url: ROUTES.DASHBOARD,
            icon: LayoutDashboard,
            roles: ["employee", "hr", "manager", "admin"] as UserRole[],
          },
          // Parking — empleado/hr (reservas, cesiones, visitantes)
          ...(parkingEnabled
            ? [
                {
                  title: "Parking",
                  url: ROUTES.PARKING,
                  icon: ParkingCircle,
                  roles: ["employee", "hr"] as UserRole[],
                  items: parkingSubItems,
                },
              ]
            : []),
          // Parking — manager/admin (reservas/cesiones, visitantes, asignaciones)
          ...(parkingEnabled
            ? [
                {
                  title: "Parking",
                  url: ROUTES.PARKING,
                  icon: ParkingCircle,
                  roles: ["manager", "admin"] as UserRole[],
                  items: managerParkingItems,
                },
              ]
            : []),
          // Oficinas — empleado/hr (reservas, cesiones)
          ...(officeEnabled
            ? [
                {
                  title: "Oficinas",
                  url: ROUTES.OFFICES,
                  icon: Building2,
                  roles: ["employee", "hr"] as UserRole[],
                  items: oficinasSubItems,
                },
              ]
            : []),
          // Oficinas — manager/admin (reservas/cesiones, asignaciones)
          ...(officeEnabled
            ? [
                {
                  title: "Oficinas",
                  url: ROUTES.OFFICES,
                  icon: Building2,
                  roles: ["manager", "admin"] as UserRole[],
                  items: managerOficinaItems,
                },
              ]
            : []),
          // Vacaciones — empleado (solo "Mis solicitudes")
          ...(vacacionesEnabled
            ? [
                {
                  title: "Vacaciones",
                  url: ROUTES.LEAVE,
                  icon: Palmtree,
                  roles: ["employee"] as UserRole[],
                  items: [
                    {
                      title: "Mis solicitudes",
                      url: ROUTES.LEAVE_MY_REQUESTS,
                      icon: CalendarCheck,
                    },
                  ],
                },
              ]
            : []),
          // Vacaciones — hr/manager/admin (Mis solicitudes + Gestionar)
          ...(vacacionesEnabled
            ? [
                {
                  title: "Vacaciones",
                  url: ROUTES.LEAVE,
                  icon: Palmtree,
                  roles: ["hr", "manager", "admin"] as UserRole[],
                  items: [
                    {
                      title: "Mis solicitudes",
                      url: ROUTES.LEAVE_MY_REQUESTS,
                      icon: CalendarCheck,
                    },
                    {
                      title: "Gestionar",
                      url: ROUTES.LEAVE_MANAGE,
                      icon: ClipboardList,
                    },
                  ],
                },
              ]
            : []),
          // Tablón — empleado (solo novedades)
          ...(tablonEnabled
            ? [
                {
                  title: "Tablón",
                  url: ROUTES.TABLON,
                  icon: Megaphone,
                  badge: tablonBadge,
                  roles: ["employee"] as UserRole[],
                },
              ]
            : []),
          // Tablón — hr/manager/admin (Novedades + Gestionar)
          ...(tablonEnabled
            ? [
                {
                  title: "Tablón",
                  url: ROUTES.TABLON,
                  icon: Megaphone,
                  badge: tablonBadge,
                  roles: ["hr", "manager", "admin"] as UserRole[],
                  items: [
                    {
                      title: "Novedades",
                      url: ROUTES.TABLON,
                      icon: Megaphone,
                    },
                    {
                      title: "Gestionar",
                      url: ROUTES.TABLON_MANAGE,
                      icon: ClipboardList,
                    },
                  ],
                },
              ]
            : []),
        ],
      },
      // ─── General ───────────────────────────────────────────
      {
        title: "General",
        items: [
          {
            title: "Directorio",
            url: ROUTES.DIRECTORIO,
            icon: BookUser,
            roles: ["employee", "hr", "manager", "admin"] as UserRole[],
          },
          {
            title: "Sedes",
            url: ROUTES.ADMIN_ENTITIES,
            icon: Landmark,
            roles: ["admin"] as UserRole[],
          },
          // Ajustes — los ítems personales son comunes a todos los roles.
          // Manager y admin añaden configuración de sede/global por composición.
          {
            title: "Ajustes",
            icon: Settings,
            roles: ["employee", "hr"] as UserRole[],
            items: settingsBase,
          },
          {
            title: "Ajustes",
            icon: Settings,
            roles: ["manager"] as UserRole[],
            items: [
              ...settingsBase,
              {
                title: "Parking",
                url: ROUTES.ADMIN_SETTINGS_PARKING,
                icon: Car,
              },
              {
                title: "Oficinas",
                url: ROUTES.ADMIN_SETTINGS_OFFICES,
                icon: Building2,
              },
            ],
          },
          {
            title: "Ajustes",
            icon: Settings,
            roles: ["admin"] as UserRole[],
            items: [
              ...settingsBase,
              { title: "General", url: ROUTES.ADMIN_SETTINGS, icon: Globe },
              {
                title: "Parking",
                url: ROUTES.ADMIN_SETTINGS_PARKING,
                icon: Car,
              },
              {
                title: "Oficinas",
                url: ROUTES.ADMIN_SETTINGS_OFFICES,
                icon: Building2,
              },
            ],
          },
        ],
      },
    ],
  };
}
