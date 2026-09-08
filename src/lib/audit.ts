/**
 * Audit Log
 *
 * Función helper para registrar eventos de auditoría en `audit_events`.
 * Llamar EXPLÍCITAMENTE en las acciones sensibles:
 *   - payslip.viewed    — descarga de nómina
 *   - leave.approved    — aprobación de vacaciones
 *   - leave.rejected    — rechazo de vacaciones
 *   - role.changed      — cambio de rol de usuario
 *   - document.deleted  — borrado de documento
 *   - user.deleted      — borrado de cuenta
 *
 * No usar como middleware — siempre llamar explícitamente.
 */

import { db } from "@/lib/db";
import { auditEvents } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/helpers";

export type AuditEventType =
  | "payslip.viewed"
  | "leave.approved"
  | "leave.rejected"
  | "role.changed"
  | "document.deleted"
  | "user.deleted"
  | "spot.assigned"
  | "spot.unassigned";

export type AuditEntityType =
  "document" | "leave_request" | "profile" | "user" | "spot";

/**
 * Registra un evento de auditoría.
 * Silencioso en caso de error — nunca debe bloquear la acción principal.
 */
export async function logAuditEvent(
  eventType: AuditEventType,
  entityType: AuditEntityType,
  entityId: string | null,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    const user = await getCurrentUser();
    if (!user) return;

    await db.insert(auditEvents).values({
      actorId: user.id,
      actorEmail: user.email,
      eventType,
      entityType,
      entityId: entityId ?? undefined,
      metadata,
    });
  } catch (err) {
    // Audit log failure must never break the caller action
    console.error("[audit] logAuditEvent error:", err);
  }
}
