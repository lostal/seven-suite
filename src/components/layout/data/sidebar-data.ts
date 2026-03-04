/**
 * Sidebar Navigation Data
 *
 * Defines the navigation structure for the app sidebar.
 * Items are grouped by section and support icons, badges, and sub-items.
 *
 * Role visibility:
 *   employee   → usuario general (puede reservar y ceder si tiene plaza asignada)
 *   admin      → administrador (gestiona usuarios, plazas y configuración)
 */

import {
  LayoutDashboard,
  Users,
  Shield,
  Settings,
  User,
  Bell,
  Cloud,
  MapPin,
  LayoutGrid,
  Building2,
  SlidersHorizontal,
  ParkingCircle,
  ArrowLeftRight,
  CalendarCheck,
} from "lucide-react";
import { ROUTES } from "@/lib/constants";
import { type SidebarData } from "../types";

interface SidebarDataParams {
  hasParkingSpot: boolean;
  hasOfficeSpot: boolean;
  visitorBookingEnabled: boolean;
}

export function getSidebarData({
  hasParkingSpot,
  hasOfficeSpot,
  visitorBookingEnabled,
}: SidebarDataParams): SidebarData {
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
    ...(visitorBookingEnabled
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

  return {
    navGroups: [
      {
        title: "General",
        items: [
          {
            title: "Panel",
            url: ROUTES.DASHBOARD,
            icon: LayoutDashboard,
            roles: ["admin"],
          },
          {
            title: "Parking",
            url: ROUTES.PARKING,
            icon: ParkingCircle,
            roles: ["employee"],
            items: parkingSubItems,
          },
          {
            title: "Oficinas",
            url: ROUTES.OFFICES,
            icon: Building2,
            roles: ["employee"],
            items: oficinasSubItems,
          },
          {
            title: "Visitantes",
            url: ROUTES.VISITORS,
            icon: Users,
            roles: ["admin"],
          },
        ],
      },
      {
        title: "Administración",
        items: [
          {
            title: "Plazas",
            url: ROUTES.ADMIN,
            icon: LayoutGrid,
            roles: ["admin"],
          },
          {
            title: "Usuarios",
            url: ROUTES.ADMIN_USERS,
            icon: Users,
            roles: ["admin"],
          },
          {
            title: "Configuración",
            url: ROUTES.ADMIN_SETTINGS,
            icon: SlidersHorizontal,
            roles: ["admin"],
          },
          {
            title: "Ajustes",
            icon: Settings,
            items: [
              {
                title: "Perfil",
                url: ROUTES.SETTINGS,
                icon: User,
              },
              {
                title: "Notificaciones",
                url: ROUTES.SETTINGS_NOTIFICATIONS,
                icon: Bell,
              },
              {
                title: "Preferencias",
                url: ROUTES.SETTINGS_PREFERENCES,
                icon: Settings,
              },
              {
                title: "Microsoft 365",
                url: ROUTES.SETTINGS_MICROSOFT,
                icon: Cloud,
              },
              {
                title: "Seguridad",
                url: ROUTES.SETTINGS_SECURITY,
                icon: Shield,
              },
            ],
          },
        ],
      },
    ],
  };
}
