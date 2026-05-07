/**
 * Tests de Audit Log
 *
 * Verifica que logAuditEvent:
 * - Registra eventos con todos los campos correctamente
 * - No inserta si getCurrentUser retorna null (usuario no autenticado)
 * - Atrapa errores de BD sin propagarlos (nunca rompe la acción principal)
 * - Usa undefined para entityId cuando se pasa null
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDb, resetDbMocks } from "../../mocks/db";

vi.mock("@/lib/db", async () => {
  const { mockDb } = await import("../../mocks/db");
  return { db: mockDb };
});

vi.mock("@/lib/auth/helpers", () => ({
  getCurrentUser: vi.fn(),
}));

import { getCurrentUser, type AuthUser } from "@/lib/auth/helpers";
import { logAuditEvent } from "@/lib/audit";

function setupAuthUser(overrides?: Partial<AuthUser>) {
  vi.mocked(getCurrentUser).mockResolvedValue({
    id: "user-00000000-0000-0000-0000-000000000001",
    email: "test@example.com",
    profile: { role: "employee" } as AuthUser["profile"],
    ...overrides,
  } as AuthUser);
}

describe("logAuditEvent", () => {
  beforeEach(() => {
    resetDbMocks();
    vi.clearAllMocks();
  });

  it("inserts audit event when user is authenticated", async () => {
    setupAuthUser();

    await logAuditEvent("role.changed", "user", "target-user-id", {
      previousRole: "employee",
      newRole: "admin",
    });

    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    const builder = vi.mocked(mockDb.insert).mock.results[0]?.value;
    expect(builder.values).toHaveBeenCalled();
    const valuesArg = vi.mocked(builder.values).mock.calls[0]?.[0] as
      | Record<string, unknown>
      | undefined;
    expect(valuesArg).toBeDefined();
    expect(valuesArg!.actorId).toBe(
      "user-00000000-0000-0000-0000-000000000001"
    );
    expect(valuesArg!.actorEmail).toBe("test@example.com");
    expect(valuesArg!.eventType).toBe("role.changed");
    expect(valuesArg!.entityType).toBe("user");
    expect(valuesArg!.entityId).toBe("target-user-id");
    expect(valuesArg!.metadata).toEqual({
      previousRole: "employee",
      newRole: "admin",
    });
  });

  it("returns early without inserting when user is null", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    await logAuditEvent("payslip.viewed", "document", "doc-id");

    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("catches DB insert errors and does not propagate them", async () => {
    setupAuthUser();

    // Throw synchronously from insert to simulate DB error.
    // logAuditEvent catches all errors silently.
    vi.mocked(mockDb.insert).mockImplementationOnce(() => {
      throw new Error("DB connection failed");
    });

    await expect(
      logAuditEvent("leave.approved", "leave_request", "lr-id")
    ).resolves.toBeUndefined();
  });

  it("uses undefined for entityId when null is passed", async () => {
    setupAuthUser();

    await logAuditEvent("document.deleted", "document", null);

    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    const builder = vi.mocked(mockDb.insert).mock.results[0]?.value;
    expect(builder.values).toHaveBeenCalled();
    const valuesArg = vi.mocked(builder.values).mock.calls[0]?.[0] as
      | Record<string, unknown>
      | undefined;
    expect(valuesArg!.entityId).toBeUndefined();
  });

  it("accepts empty metadata object (default)", async () => {
    setupAuthUser();

    await logAuditEvent("user.deleted", "profile", "some-user-id");

    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    const builder = vi.mocked(mockDb.insert).mock.results[0]?.value;
    expect(builder.values).toHaveBeenCalled();
    const valuesArg = vi.mocked(builder.values).mock.calls[0]?.[0] as
      | Record<string, unknown>
      | undefined;
    expect(valuesArg!.metadata).toEqual({});
  });

  it("supports all defined AuditEventType values", async () => {
    setupAuthUser();

    const eventTypes = [
      "payslip.viewed",
      "leave.approved",
      "leave.rejected",
      "role.changed",
      "document.deleted",
      "user.deleted",
      "spot.assigned",
      "spot.unassigned",
    ] as const;

    for (const eventType of eventTypes) {
      setupAuthUser();
      await expect(
        logAuditEvent(eventType, "user", "some-id")
      ).resolves.toBeUndefined();
      expect(mockDb.insert).toHaveBeenCalled();
      vi.clearAllMocks();
    }
  });

  it("calls getCurrentUser exactly once per invocation", async () => {
    setupAuthUser();

    await logAuditEvent("spot.assigned", "spot", "spot-id");

    expect(getCurrentUser).toHaveBeenCalledTimes(1);
  });
});
