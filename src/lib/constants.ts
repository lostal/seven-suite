/**
 * Application-wide constants
 *
 * Centralized config values, magic strings, and defaults.
 */

/** Application metadata */
export const APP_NAME = "GRUPOSIETE Reservas";
export const APP_DESCRIPTION =
  "Sistema de gestión de reservas de espacios corporativos";

/** Route paths */
export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  CALLBACK: "/auth/callback",
  DASHBOARD: "/panel",
  /** Home page for non-admin roles (employee) */
  PARKING: "/parking",
  MIS_RESERVAS: "/mis-reservas",
  PARKING_CESSIONS: "/parking/cesiones",
  /** @deprecated La ruta del mapa se ha movido a /oficinas/mapa; mantener para redirect */
  PARKING_MAP: "/parking/mapa",
  OFFICES_MAP: "/oficinas/mapa",
  PARKING_RESERVAS: "/parking/reservas",
  OFFICES_RESERVAS: "/oficinas/reservas",
  VISITORS: "/parking/visitantes",
  ADMIN: "/administracion",
  ADMIN_USERS: "/administracion/usuarios",
  ADMIN_SETTINGS: "/administracion/ajustes",
  ADMIN_SETTINGS_PARKING: "/administracion/ajustes/parking",
  ADMIN_SETTINGS_OFFICES: "/administracion/ajustes/oficinas",

  OFFICES: "/oficinas",
  OFFICES_CESSIONS: "/oficinas/cesiones",
  SETTINGS: "/ajustes",
  SETTINGS_NOTIFICATIONS: "/ajustes/notificaciones",
  SETTINGS_PREFERENCES: "/ajustes/preferencias",
  SETTINGS_MICROSOFT: "/ajustes/microsoft",
  SETTINGS_SECURITY: "/ajustes/seguridad",
} as const;

/**
 * Returns the first page a user should land on after login,
 * mirroring the order of items in the sidebar (first visible item per role).
 */
export function getHomeRouteForRole(
  role: "admin" | "employee" | string | undefined | null
): string {
  if (role === "admin") return ROUTES.DASHBOARD;
  return ROUTES.PARKING;
}

/** External links */
export const EXTERNAL = {
  SEDE_ADDRESS: "Sede GRUPOSIETE, Madrid",
} as const;
