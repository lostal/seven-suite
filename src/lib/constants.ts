/**
 * Application-wide constants
 *
 * Centralized config values, magic strings, and defaults.
 */

/** Application metadata */
export const APP_NAME = "Seven Suite";
export const APP_DESCRIPTION = "Sistema de gestión de espacios corporativos";

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
  OFFICES_MAP: "/oficinas/mapa",
  PARKING_RESERVAS: "/parking/reservas",
  OFFICES_RESERVAS: "/oficinas/reservas",
  VISITORS: "/parking/visitantes",
  ADMIN: "/administracion",
  ADMIN_PARKING: "/parking/asignaciones",
  ADMIN_OFFICES: "/oficinas/asignaciones",
  // Settings — unified under /ajustes
  SETTINGS: "/ajustes",
  SETTINGS_NOTIFICATIONS: "/ajustes/notificaciones",
  SETTINGS_APPEARANCE: "/ajustes/apariencia",
  SETTINGS_MICROSOFT: "/ajustes/microsoft",
  SETTINGS_SECURITY: "/ajustes/seguridad",
  // Admin-only system config
  ADMIN_SETTINGS: "/ajustes/general",
  ADMIN_SETTINGS_PARKING: "/ajustes/parking",
  ADMIN_SETTINGS_OFFICES: "/ajustes/oficinas",

  OFFICES: "/oficinas",
  OFFICES_CESSIONS: "/oficinas/cesiones",
  ADMIN_ENTITIES: "/administracion/entidades",
  DIRECTORIO: "/directorio",
  // Legacy
  SETTINGS_PREFERENCES: "/ajustes/apariencia",
  LEAVE: "/vacaciones",
  LEAVE_MY_REQUESTS: "/vacaciones/mis-solicitudes",
  LEAVE_MANAGE: "/vacaciones/gestionar",
  TABLON: "/tablon",
  TABLON_MANAGE: "/tablon/gestionar",
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

// ─── Spot type labels ─────────────────────────────────────────────────────────
//
// Los valores del enum en BD (`standard`, `visitor`) son identificadores
// técnicos internos. Esta función traduce esos valores a etiquetas de negocio
// según el módulo, ya que el mismo valor `visitor` tiene connotaciones
// distintas según el recurso:
//   • parking / visitor  → "Visitas"    (plaza para visitantes externos)
//   • office  / visitor  → "Flexible"   (plaza sin propietario fijo)
//   • */standard         → "Fija"       (plaza asignada a un usuario)

// ─── Comunidades Autónomas ────────────────────────────────────────────────────

export const AUTONOMOUS_COMMUNITIES = [
  { code: "ES-AN", name: "Andalucía" },
  { code: "ES-AR", name: "Aragón" },
  { code: "ES-AS", name: "Asturias" },
  { code: "ES-CN", name: "Canarias" },
  { code: "ES-CB", name: "Cantabria" },
  { code: "ES-CL", name: "Castilla y León" },
  { code: "ES-CM", name: "Castilla-La Mancha" },
  { code: "ES-CT", name: "Cataluña" },
  { code: "ES-CE", name: "Ceuta" },
  { code: "ES-EX", name: "Extremadura" },
  { code: "ES-GA", name: "Galicia" },
  { code: "ES-IB", name: "Illes Balears" },
  { code: "ES-RI", name: "La Rioja" },
  { code: "ES-MD", name: "Madrid" },
  { code: "ES-ML", name: "Melilla" },
  { code: "ES-MC", name: "Murcia" },
  { code: "ES-NC", name: "Navarra" },
  { code: "ES-PV", name: "País Vasco" },
  { code: "ES-VC", name: "Comunitat Valenciana" },
] as const;

export type AutonomousCommunityCode =
  (typeof AUTONOMOUS_COMMUNITIES)[number]["code"];

export function getSpotTypeLabel(
  type: "standard" | "visitor",
  resourceType: "parking" | "office"
): string {
  if (type === "standard") return "Fija";
  return resourceType === "office" ? "Flexible" : "Visitas";
}
