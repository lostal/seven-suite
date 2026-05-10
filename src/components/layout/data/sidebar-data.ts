/**
 * Sidebar Navigation Data
 *
 * Defines the navigation structure for the app sidebar.
 * Items are grouped by section and support icons, badges, and sub-items.
 *
 * Role visibility:
 *   employee   → usuario general (puede reservar y ceder si tiene plaza asignada)
 *   admin      → administrador (gestiona usuarios, plazas y configuración)
 *
 * Estructura de grupos:
 *   "Sede activa"  → Contenido que varía según la sede seleccionada (módulos habilitados)
 *   "Global"       → Siempre visible para admins: Directorio, Sedes, Ajustes
 */

import {
  LayoutDashboard,
  Users,
  Settings,
  MapPin,
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
  // "visitors" es un módulo independiente dentro del módulo parking
  const visitorsEnabled =
    parkingEnabled && (!enabledModules || enabledModules.includes("visitors"));

  const tablonBadge =
    unreadAnnouncementsCount > 0 ? String(unreadAnnouncementsCount) : undefined;

  // ─── Subitems de empleado ─────────────────────────────────
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
    { title: "Mapa", url: ROUTES.OFFICES_MAP, icon: MapPin },
  ];

  // ─── Subitems de admin ────────────────────────────────────
  const adminParkingItems = [
    ...(visitorsEnabled
      ? [{ title: "Visitantes", url: ROUTES.VISITORS, icon: Users }]
      : []),
    { title: "Asignaciones", url: ROUTES.ADMIN_PARKING, icon: LayoutGrid },
  ];

  const adminOficinaItems = [
    { title: "Asignaciones", url: ROUTES.ADMIN_OFFICES, icon: LayoutGrid },
  ];

  return {
    navGroups: [
      // ─── Sede activa: varía según módulos habilitados ──────
      {
        title: "Sede activa",
        items: [
          // Panel (admin — analytics de la sede activa)
          {
            title: "Panel",
            url: ROUTES.DASHBOARD,
            icon: LayoutDashboard,
            roles: ["admin"] as UserRole[],
          },
          // Parking (employee)
          ...(parkingEnabled
            ? [
                {
                  title: "Parking",
                  url: ROUTES.PARKING,
                  icon: ParkingCircle,
                  roles: ["employee"] as UserRole[],
                  items: parkingSubItems,
                },
              ]
            : []),
          // Parking (admin)
          ...(parkingEnabled
            ? [
                {
                  title: "Parking",
                  icon: ParkingCircle,
                  roles: ["admin"] as UserRole[],
                  items: adminParkingItems,
                },
              ]
            : []),
          // Oficinas (employee)
          ...(officeEnabled
            ? [
                {
                  title: "Oficinas",
                  url: ROUTES.OFFICES,
                  icon: Building2,
                  roles: ["employee"] as UserRole[],
                  items: oficinasSubItems,
                },
              ]
            : []),
          // Oficinas (admin)
          ...(officeEnabled
            ? [
                {
                  title: "Oficinas",
                  icon: Building2,
                  roles: ["admin"] as UserRole[],
                  items: adminOficinaItems,
                },
              ]
            : []),
          // Vacaciones — employee ve solo "Mis solicitudes"
          ...(vacacionesEnabled
            ? [
                {
                  title: "Vacaciones",
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
                // manager/hr/admin ven también "Gestionar"
                {
                  title: "Vacaciones",
                  icon: Palmtree,
                  roles: ["manager", "hr", "admin"] as UserRole[],
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
          // Tablón — todos ven las novedades; manager/hr/admin también pueden gestionar
          ...(tablonEnabled
            ? [
                {
                  title: "Tablón",
                  url: ROUTES.TABLON,
                  icon: Megaphone,
                  badge: tablonBadge,
                  roles: ["employee"] as UserRole[],
                },
                {
                  title: "Tablón",
                  icon: Megaphone,
                  badge: tablonBadge,
                  roles: ["manager", "hr", "admin"] as UserRole[],
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
            roles: ["admin"] as UserRole[],
          },
          {
            title: "Sedes",
            url: ROUTES.ADMIN_ENTITIES,
            icon: Landmark,
            roles: ["admin"] as UserRole[],
          },
          {
            title: "Ajustes",
            icon: Settings,
            roles: ["employee", "manager", "hr"] as UserRole[],
            items: [
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
              {
                title: "Seguridad",
                url: "/ajustes/seguridad",
                icon: Shield,
              },
            ],
          },
          {
            title: "Ajustes",
            icon: Settings,
            roles: ["admin"] as UserRole[],
            items: [
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
              {
                title: "Seguridad",
                url: "/ajustes/seguridad",
                icon: Shield,
              },
              {
                title: "General",
                url: "/ajustes/general",
                icon: Globe,
              },
              {
                title: "Parking",
                url: "/ajustes/parking",
                icon: Car,
              },
              {
                title: "Oficinas",
                url: "/ajustes/oficinas",
                icon: Building2,
              },
            ],
          },
        ],
      },
    ],
  };
}
