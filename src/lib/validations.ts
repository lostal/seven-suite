/**
 * Validation Schemas
 *
 * Zod schemas for Server Actions and form validation.
 * Shared between client (form validation) and server (action validation).
 */

import { z } from "zod/v4";

const isoCalendarDate = z.iso.date().refine((value) => {
  const [y, m, d] = value.split("-").map(Number);
  const parsed = new Date(y!, m! - 1, d!);
  return (
    parsed.getFullYear() === y &&
    parsed.getMonth() === m! - 1 &&
    parsed.getDate() === d
  );
}, "Fecha inválida");

// ─── Reservations ────────────────────────────────────────────

export const createReservationSchema = z.object({
  spot_id: z.string().uuid(),
  date: isoCalendarDate,
  notes: z.string().max(500).optional(),
});

export type CreateReservationInput = z.infer<typeof createReservationSchema>;

// ─── Cessions ────────────────────────────────────────────────

export const createCessionSchema = z.object({
  spot_id: z.string().uuid(),
  dates: z.array(isoCalendarDate).min(1, "Selecciona al menos un día"),
});

export type CreateCessionInput = z.infer<typeof createCessionSchema>;

// ─── Visitors ────────────────────────────────────────────────

export const createVisitorReservationSchema = z.object({
  spot_id: z.string().uuid(),
  date: isoCalendarDate,
  visitor_name: z.string().min(1, "Nombre requerido").max(200),
  visitor_company: z.string().min(1, "Empresa requerida").max(200),
  visitor_email: z.email("Email inválido"),
  notes: z.string().max(500).optional(),
});

export type CreateVisitorReservationInput = z.infer<
  typeof createVisitorReservationSchema
>;

// ─── Admin: Spots ────────────────────────────────────────────

export const createSpotSchema = z.object({
  label: z.string().min(1, "Etiqueta requerida").max(20),
  type: z.enum(["standard", "visitor"]),
  resource_type: z.enum(["parking", "office"]),
  assigned_to: z.string().uuid().optional(),
});

export type CreateSpotInput = z.infer<typeof createSpotSchema>;

export const updateSpotSchema = createSpotSchema
  .omit({ assigned_to: true })
  .partial()
  .extend({
    id: z.string().uuid(),
    is_active: z.boolean().optional(),
  });

export type UpdateSpotInput = z.infer<typeof updateSpotSchema>;

// ─── Cancel Operations ───────────────────────────────────────

/** Schema base reutilizado por todas las operaciones de cancelación por id. */
const cancelByIdSchema = z.object({ id: z.string().uuid() });

export const cancelReservationSchema = cancelByIdSchema;
export type CancelReservationInput = z.infer<typeof cancelReservationSchema>;

export const cancelCessionSchema = cancelByIdSchema;
export type CancelCessionInput = z.infer<typeof cancelCessionSchema>;

export const cancelVisitorReservationSchema = cancelByIdSchema;
export type CancelVisitorReservationInput = z.infer<
  typeof cancelVisitorReservationSchema
>;

export const updateVisitorReservationSchema =
  createVisitorReservationSchema.extend({
    id: z.string().uuid(),
  });

export type UpdateVisitorReservationInput = z.infer<
  typeof updateVisitorReservationSchema
>;

// ─── Admin: Spots Delete ─────────────────────────────────────

export const deleteSpotSchema = z.object({
  id: z.string().uuid(),
});

export type DeleteSpotInput = z.infer<typeof deleteSpotSchema>;

// ─── Admin: Users ────────────────────────────────────────────

export const updateUserRoleSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(["employee", "manager", "hr", "admin"]),
});

export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;

// ─── Admin: Delete user account ────────────────────────────

export const deleteUserSchema = z.object({
  user_id: z.string().uuid(),
});
export type DeleteUserInput = z.infer<typeof deleteUserSchema>;

// ─── Admin: Assign spot to user ─────────────────────────────

export const assignSpotToUserSchema = z.object({
  user_id: z.string().uuid(),
  /** UUID of the spot to assign, or null to unassign */
  spot_id: z.string().uuid().nullable(),
  /** Resource type needed to correctly scope un/assignment to parking xor office */
  resource_type: z.enum(["parking", "office"]),
});

export type AssignSpotToUserInput = z.infer<typeof assignSpotToUserSchema>;

export const assignUserToSpotSchema = z.object({
  spot_id: z.string().uuid(),
  user_id: z.string().uuid().nullable(),
  resource_type: z.enum(["parking", "office"]),
});

// ─── Settings: Profile ───────────────────────────────────────

export const updateProfileSchema = z.object({
  full_name: z.string().min(1, "Nombre requerido").max(200).optional(),
  avatar_url: z.string().url("URL inválida").optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// ─── Settings: Notifications ─────────────────────────────────

export const updateNotificationPreferencesSchema = z.object({
  notification_channel: z.enum(["teams", "email", "both"]),
  notify_reservation_confirmed: z.boolean(),
  notify_reservation_reminder: z.boolean(),
  notify_cession_reserved: z.boolean(),
  notify_alert_triggered: z.boolean(),
  notify_visitor_confirmed: z.boolean(),
  notify_daily_digest: z.boolean(),
  daily_digest_time: z
    .string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato HH:MM")
    .optional(),
});

export type UpdateNotificationPreferencesInput = z.infer<
  typeof updateNotificationPreferencesSchema
>;

// ─── Settings: Theme only ─────────────────────────────────────

export const updateThemeSchema = z.object({
  theme: z.enum(["light", "dark", "system"]),
});

export type UpdateThemeInput = z.infer<typeof updateThemeSchema>;

// ─── Settings: Outlook Sync ──────────────────────────────────

export const updateOutlookPreferencesSchema = z.object({
  outlook_create_events: z.boolean(),
  outlook_calendar_name: z.string().min(1).max(100).optional(),
  outlook_sync_enabled: z.boolean(),
  outlook_sync_interval: z.number().int().min(5).max(120).optional(), // 5-120 minutes
});

export type UpdateOutlookPreferencesInput = z.infer<
  typeof updateOutlookPreferencesSchema
>;

// ─── Settings: Auto-Cession Rules ───────────────────────────

export const updateCessionRulesSchema = z.object({
  auto_cede_on_ooo: z.boolean(),
  auto_cede_notify: z.boolean(),
  auto_cede_days: z.array(z.number().int().min(0).max(6)), // 0-6 (Sun-Sat)
});

export type UpdateCessionRulesInput = z.infer<typeof updateCessionRulesSchema>;

// ─── Admin: System Config ─────────────────────────────────────

/** Schema para configurar las claves globales del sistema */
export const updateGlobalConfigSchema = z.object({
  notifications_enabled: z.boolean(),
  email_notifications_enabled: z.boolean(),
  teams_notifications_enabled: z.boolean(),
});

export type UpdateGlobalConfigInput = z.infer<typeof updateGlobalConfigSchema>;

/** Schema base de configuración de recurso (parking u oficina).
 * Los valores por defecto viven en `src/lib/config.ts` (PARKING_DEFAULTS / OFFICE_DEFAULTS)
 * y se inyectan en el formulario admin desde la config actual del sistema.
 * Este schema sólo valida rangos — no define defaults propios. */
export const updateResourceConfigSchema = z.object({
  booking_enabled: z.boolean(),
  visitor_booking_enabled: z.boolean(),
  allowed_days: z
    .array(z.number().int().min(0).max(6))
    .min(1, "Selecciona al menos un día"),
  /** null = sin límite de antelación */
  max_advance_days: z.number().int().min(1).max(365).nullable(),
  /** null = sin límite de días consecutivos */
  max_consecutive_days: z.number().int().min(1).max(30).nullable(),
  /** null = sin límite semanal */
  max_weekly_reservations: z.number().int().min(1).max(50).nullable(),
  /** null = sin límite mensual */
  max_monthly_reservations: z.number().int().min(1).max(200).nullable(),
  /** null = sin límite diario */
  max_daily_reservations: z.number().int().min(1).max(50).nullable(),
  time_slots_enabled: z.boolean(),
  slot_duration_minutes: z.number().int().min(15).max(480).nullable(),
  day_start_hour: z.number().int().min(0).max(23).nullable(),
  day_end_hour: z.number().int().min(1).max(24).nullable(),
  cession_enabled: z.boolean(),
  cession_min_advance_hours: z.number().int().min(0).max(168),
  cession_max_per_week: z.number().int().min(1).max(7),
  auto_cession_enabled: z.boolean(),
});

export type UpdateResourceConfigInput = z.infer<
  typeof updateResourceConfigSchema
>;

// ─── Admin: Entities ──────────────────────────────────────────────────────────

export const createEntitySchema = z.object({
  name: z.string().min(1, "Nombre requerido").max(100),
  is_active: z.boolean().optional(),
  autonomous_community: z.string().optional().nullable(),
});
export type CreateEntityInput = z.infer<typeof createEntitySchema>;

export const updateEntitySchema = createEntitySchema.partial().extend({
  id: z.string().uuid(),
});
export type UpdateEntityInput = z.infer<typeof updateEntitySchema>;

export const deleteEntitySchema = z.object({ id: z.string().uuid() });
export type DeleteEntityInput = z.infer<typeof deleteEntitySchema>;

export const ENTITY_MODULES = [
  "parking",
  "office",
  "visitors",
  "vacaciones",
  "tablon",
] as const;
export type EntityModuleKey = (typeof ENTITY_MODULES)[number];

export const toggleEntityModuleSchema = z.object({
  entity_id: z.string().uuid(),
  module: z.enum(ENTITY_MODULES),
  enabled: z.boolean(),
});
export type ToggleEntityModuleInput = z.infer<typeof toggleEntityModuleSchema>;

// ─── Office Reservations ──────────────────────────────────────

export const createOfficeReservationSchema = z
  .object({
    spot_id: z.string().uuid(),
    date: z.iso.date(),
    start_time: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato HH:MM")
      .optional(),
    end_time: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato HH:MM")
      .optional(),
    notes: z.string().max(500).optional(),
  })
  .refine(
    (data) => (data.start_time === undefined) === (data.end_time === undefined),
    {
      message:
        "Si se especifica hora de inicio, la hora de fin es obligatoria y viceversa",
      path: ["end_time"],
    }
  )
  .refine(
    (data) =>
      !data.start_time || !data.end_time || data.end_time > data.start_time,
    {
      message: "La hora de fin debe ser posterior a la hora de inicio",
      path: ["end_time"],
    }
  );

export type CreateOfficeReservationInput = z.infer<
  typeof createOfficeReservationSchema
>;

// ─── Admin: Directorio ────────────────────────────────────────

export const updateDirectorioUserSchema = z.object({
  user_id: z.string().uuid(),
  nombre: z.string().min(1, "Nombre requerido"),
  puesto: z.string().optional().default(""),
  telefono: z.string().optional().default(""),
  entity_id: z.string().uuid().optional(),
});
export type UpdateDirectorioUserInput = z.infer<
  typeof updateDirectorioUserSchema
>;

export const createDirectorioUserSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido"),
  correo: z.string().email("Email inválido"),
  puesto: z.string().optional().default(""),
  telefono: z.string().optional().default(""),
  entity_id: z.string().uuid().optional(),
});
export type CreateDirectorioUserInput = z.infer<
  typeof createDirectorioUserSchema
>;

// ─── Leave Requests ───────────────────────────────────────────

export const LEAVE_TYPES = ["vacation", "personal", "sick", "other"] as const;
export type LeaveTypeValue = (typeof LEAVE_TYPES)[number];

export const LEAVE_TYPE_LABELS: Record<LeaveTypeValue, string> = {
  vacation: "Vacaciones",
  personal: "Asuntos personales",
  sick: "Baja médica",
  other: "Otro",
};

export const createLeaveRequestSchema = z
  .object({
    leave_type: z.enum(LEAVE_TYPES),
    start_date: z.iso.date(),
    end_date: z.iso.date(),
    reason: z.string().max(500).optional().nullable(),
  })
  .refine((d) => d.end_date >= d.start_date, {
    message: "La fecha de fin no puede ser anterior a la de inicio",
    path: ["end_date"],
  });
export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>;

export const updateLeaveRequestSchema = z
  .object({
    id: z.string().uuid(),
    leave_type: z.enum(LEAVE_TYPES),
    start_date: z.iso.date(),
    end_date: z.iso.date(),
    reason: z.string().max(500).optional().nullable(),
  })
  .refine((d) => d.end_date >= d.start_date, {
    message: "La fecha de fin no puede ser anterior a la de inicio",
    path: ["end_date"],
  });
export type UpdateLeaveRequestInput = z.infer<typeof updateLeaveRequestSchema>;

export const approveLeaveRequestSchema = z.object({
  id: z.string().uuid(),
  notes: z.string().max(500).optional().nullable(),
});
export type ApproveLeaveRequestInput = z.infer<
  typeof approveLeaveRequestSchema
>;

export const rejectLeaveRequestSchema = z.object({
  id: z.string().uuid(),
  notes: z.string().min(1, "El motivo del rechazo es obligatorio").max(500),
});
export type RejectLeaveRequestInput = z.infer<typeof rejectLeaveRequestSchema>;

export const cancelLeaveRequestSchema = z.object({
  id: z.string().uuid(),
});
export type CancelLeaveRequestInput = z.infer<typeof cancelLeaveRequestSchema>;

// ─── Announcements (Tablón) ────────────────────────────────────

export const createAnnouncementSchema = z.object({
  title: z.string().min(1, "Título requerido").max(200),
  body: z
    .string()
    .min(1, "El contenido no puede estar vacío")
    .max(10000, "El contenido no puede exceder 10.000 caracteres"),
  entity_id: z.string().uuid().nullable().optional(),
  publish: z.boolean().optional(),
});
export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;

export const updateAnnouncementSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1, "Título requerido").max(200).optional(),
  body: z
    .string()
    .min(1, "El contenido no puede estar vacío")
    .max(10000, "El contenido no puede exceder 10.000 caracteres")
    .optional(),
  entity_id: z.string().uuid().nullable().optional(),
  publish: z.boolean().optional(),
});
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;

export const publishAnnouncementSchema = z.object({ id: z.string().uuid() });
export type PublishAnnouncementInput = z.infer<
  typeof publishAnnouncementSchema
>;

export const deleteAnnouncementSchema = z.object({ id: z.string().uuid() });
export type DeleteAnnouncementInput = z.infer<typeof deleteAnnouncementSchema>;

export const markAnnouncementReadSchema = z.object({
  announcement_id: z.string().uuid(),
});
export type MarkAnnouncementReadInput = z.infer<
  typeof markAnnouncementReadSchema
>;
