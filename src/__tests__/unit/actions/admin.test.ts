/**
 * Tests de Server Actions de Administración
 *
 * Verifica la lógica de negocio de:
 * - createSpot: creación de plazas con validación y manejo de duplicados
 * - updateSpot: actualización con validación de constraint único
 * - deleteSpot: eliminación por id
 * - updateUserRole: cambio de rol de usuario
 * - assignSpotToUser: asignación/desasignación de plaza de dirección
 * - assignUserToSpot: asignación desde perspectiva de plaza con control de cleanup
 * - deleteUser: eliminación de cuenta vía delete de tabla users
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createSpot,
  updateSpot,
  deleteSpot,
  updateUserRole,
  assignSpotToUser,
  assignUserToSpot,
  deleteUser,
} from "@/app/(dashboard)/administracion/actions";
import {
  mockDb,
  resetDbMocks,
  setupSelectMock,
  setupInsertMock,
  setupUpdateMock,
  setupDeleteMock,
  type MockDbResult,
} from "../../mocks/db";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/db", async () => {
  const { mockDb } = await import("../../mocks/db");
  return { db: mockDb };
});

vi.mock("@/lib/auth/helpers", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/queries/active-entity", () => ({
  getActiveEntityId: vi.fn().mockResolvedValue(null),
  getEffectiveEntityId: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/audit", () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

import { requireAdmin } from "@/lib/auth/helpers";
import { getActiveEntityId } from "@/lib/queries/active-entity";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const UUID = "550e8400-e29b-41d4-a716-446655440000";
const UUID2 = "660e8400-e29b-41d4-a716-446655440001";

/**
 * Configura requireAdmin como admin válido (no redirige).
 */
function setupAdminUser() {
  vi.mocked(requireAdmin).mockResolvedValue({
    id: UUID,
    email: "admin@test.com",
    profile: {
      id: UUID,
      email: "admin@test.com",
      role: "admin" as const,
      fullName: "Admin",
      avatarUrl: null,
      entityId: null,
      managerId: null,
      jobTitle: null,
      createdAt: new Date("2025-01-01T00:00:00Z"),
      updatedAt: new Date("2025-01-01T00:00:00Z"),
      dni: null,
      location: null,
      phone: null,
    },
  });
}

// ─── createSpot ───────────────────────────────────────────────────────────────

describe("createSpot", () => {
  beforeEach(() => {
    resetDbMocks();
    setupAdminUser();
  });

  it("crea la plaza y devuelve el id", async () => {
    setupInsertMock([{ id: "spot-new" }]);

    const result = await createSpot({
      label: "A-01",
      type: "standard",
      resource_type: "parking",
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toHaveProperty("id");
  });

  it("falla con mensaje claro en violación de constraint único (23505)", async () => {
    mockDb.insert.mockImplementationOnce(() => {
      throw Object.assign(
        new Error("duplicate key value violates unique constraint"),
        { code: "23505" }
      );
    });

    const result = await createSpot({
      label: "A-01",
      type: "standard",
      resource_type: "parking",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Ya existe una plaza con la etiqueta");
    }
  });

  it("falla con error genérico de BD para otros códigos", async () => {
    mockDb.insert.mockImplementationOnce(() => {
      throw new Error("Error de conexión");
    });

    const result = await createSpot({
      label: "A-01",
      type: "standard",
      resource_type: "parking",
    });

    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error).toContain("Error al crear la plaza");
  });

  it("rechaza input inválido sin llamar a la BD (validación Zod)", async () => {
    const result = await createSpot({
      label: "",
      type: "standard",
      resource_type: "parking",
    });

    expect(result.success).toBe(false);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("rechaza tipo de plaza no válido", async () => {
    const result = await createSpot({
      label: "A-01",
      type: "invalid-type" as never,
      resource_type: "parking",
    });

    expect(result.success).toBe(false);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("falla si requireAdmin lanza error (no admin)", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("No autorizado"));

    const result = await createSpot({
      label: "A-01",
      type: "standard",
      resource_type: "parking",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("No autorizado");
  });
});

// ─── updateSpot ───────────────────────────────────────────────────────────────

describe("updateSpot", () => {
  beforeEach(() => {
    resetDbMocks();
    setupAdminUser();
  });

  it("actualiza la plaza con éxito", async () => {
    // 1. select spot
    setupSelectMock([{ id: UUID, entityId: null }]);
    // 2. update spot
    setupUpdateMock([{ id: UUID }]);

    const result = await updateSpot({ id: UUID, label: "A-02" });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ updated: true });
  });

  it("falla con mensaje claro en constraint único (23505)", async () => {
    // 1. select spot succeeds
    setupSelectMock([{ id: UUID, entityId: null }]);
    // 2. update throws duplicate key
    mockDb.update.mockImplementationOnce(() => {
      throw Object.assign(
        new Error("duplicate key value violates unique constraint"),
        { code: "23505" }
      );
    });

    const result = await updateSpot({ id: UUID, label: "A-01" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Ya existe una plaza con esa etiqueta");
    }
  });

  it("falla con error genérico de BD", async () => {
    // 1. select spot succeeds
    setupSelectMock([{ id: UUID, entityId: null }]);
    // 2. update throws generic error
    mockDb.update.mockImplementationOnce(() => {
      throw new Error("Error de BD");
    });

    const result = await updateSpot({ id: UUID, label: "A-01" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Error al actualizar la plaza");
    }
  });

  it("rechaza id no UUID sin llamar a BD", async () => {
    const result = await updateSpot({ id: "no-es-uuid", label: "A-01" });

    expect(result.success).toBe(false);
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it("falla si el spot no existe", async () => {
    // select returns empty → spot not found
    setupSelectMock([]);

    const result = await updateSpot({ id: UUID, label: "A-01" });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("Plaza no encontrada");
  });
});

// ─── deleteSpot ───────────────────────────────────────────────────────────────

describe("deleteSpot", () => {
  beforeEach(() => {
    resetDbMocks();
    setupAdminUser();
  });

  it("elimina la plaza con éxito", async () => {
    // 1. select spot
    setupSelectMock([{ id: UUID, entityId: null }]);
    // 2. delete spot
    setupDeleteMock([{ id: UUID }]);

    const result = await deleteSpot({ id: UUID });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ deleted: true });
  });

  it("falla si la BD devuelve error", async () => {
    // 1. select spot succeeds
    setupSelectMock([{ id: UUID, entityId: null }]);
    // 2. delete throws error
    mockDb.delete.mockImplementationOnce(() => {
      throw new Error("Foreign key constraint");
    });

    const result = await deleteSpot({ id: UUID });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBeDefined();
  });

  it("rechaza id no UUID sin llamar a BD", async () => {
    const result = await deleteSpot({ id: "not-a-uuid" });

    expect(result.success).toBe(false);
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it("falla si el spot no existe", async () => {
    // select returns empty → spot not found
    setupSelectMock([]);

    const result = await deleteSpot({ id: UUID });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("Plaza no encontrada");
  });
});

// ─── updateUserRole ───────────────────────────────────────────────────────────

describe("updateUserRole", () => {
  beforeEach(() => {
    resetDbMocks();
    setupAdminUser();
  });

  it("actualiza el rol con éxito", async () => {
    // update profiles
    setupUpdateMock([]);

    const result = await updateUserRole({ user_id: UUID, role: "employee" });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ updated: true });
  });

  it("falla si la BD devuelve error", async () => {
    mockDb.update.mockImplementationOnce(() => {
      throw new Error("No se pudo actualizar");
    });

    const result = await updateUserRole({ user_id: UUID, role: "employee" });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBeDefined();
  });

  it("rechaza rol inválido sin llamar a BD", async () => {
    const result = await updateUserRole({
      user_id: UUID,
      role: "superuser" as never,
    });

    expect(result.success).toBe(false);
    expect(mockDb.update).not.toHaveBeenCalled();
  });
});

// ─── assignSpotToUser ─────────────────────────────────────────────────────────

describe("assignSpotToUser", () => {
  beforeEach(() => {
    resetDbMocks();
    setupAdminUser();
  });

  it("desasigna la plaza cuando spot_id es null", async () => {
    // 1. select current spot (for audit)
    setupSelectMock([]);
    // 2. update spots (clear assignment)
    setupUpdateMock([]);

    const result = await assignSpotToUser({
      user_id: UUID,
      spot_id: null,
      resource_type: "parking",
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ assigned: false });
  });

  it("asigna plaza estándar con éxito", async () => {
    // 1. select spot to validate
    setupSelectMock([
      {
        id: UUID2,
        type: "standard",
        resourceType: "parking",
        assignedTo: null,
        entityId: null,
      },
    ]);
    // 2. update spot (assign)
    setupUpdateMock([]);
    // 3. update spots (clear previous)
    setupUpdateMock([]);

    const result = await assignSpotToUser({
      user_id: UUID,
      spot_id: UUID2,
      resource_type: "parking",
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ assigned: true });
  });

  it("falla si la plaza no existe", async () => {
    // select returns empty → plaza not found
    setupSelectMock([]);

    const result = await assignSpotToUser({
      user_id: UUID,
      spot_id: UUID2,
      resource_type: "parking",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("Plaza no encontrada");
  });

  it("falla si la plaza es de tipo visitor (no asignable a usuarios)", async () => {
    // select returns a visitor spot
    setupSelectMock([
      {
        id: UUID2,
        type: "visitor",
        resourceType: "parking",
        assignedTo: null,
        entityId: null,
      },
    ]);

    const result = await assignSpotToUser({
      user_id: UUID,
      spot_id: UUID2,
      resource_type: "parking",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("No se pueden asignar plazas de visitas");
    }
  });

  it("falla si la plaza ya está asignada a otro usuario", async () => {
    // select returns spot with different assignedTo
    setupSelectMock([
      {
        id: UUID2,
        type: "standard",
        resourceType: "parking",
        assignedTo: "otro-usuario-uuid-0000-0000-000000000099",
        entityId: null,
      },
    ]);

    const result = await assignSpotToUser({
      user_id: UUID,
      spot_id: UUID2,
      resource_type: "parking",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("ya está asignada a otro usuario");
    }
  });

  it("rechaza user_id no UUID sin llamar a BD", async () => {
    const result = await assignSpotToUser({
      user_id: "no-es-uuid",
      spot_id: null,
      resource_type: "parking",
    });

    expect(result.success).toBe(false);
    expect(mockDb.select).not.toHaveBeenCalled();
  });
});

// ─── assignUserToSpot ─────────────────────────────────────────────────────────

describe("assignUserToSpot", () => {
  beforeEach(() => {
    resetDbMocks();
    setupAdminUser();
  });

  it("falla si la transacción de asignación devuelve error", async () => {
    // La transacción falla en el segundo update (cleanup)
    mockDb.update
      .mockImplementationOnce(() => {
        // First update (assign) inside transaction succeeds
        const data: MockDbResult = [{ id: UUID2 }];
        const builder: Record<string, unknown> & PromiseLike<MockDbResult> = {
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue(data),
          then<TResult1 = MockDbResult, TResult2 = never>(
            onfulfilled?:
              | ((value: MockDbResult) => TResult1 | PromiseLike<TResult1>)
              | null,
            onrejected?:
              | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
              | null
          ): PromiseLike<TResult1 | TResult2> {
            return Promise.resolve(data).then(onfulfilled, onrejected);
          },
        };
        return builder;
      })
      .mockImplementationOnce(() => {
        // Second update (cleanup) throws — transaction rolls back automatically
        throw Object.assign(new Error("cleanup failed"), { code: "PGRST999" });
      });

    const result = await assignUserToSpot({
      spot_id: UUID2,
      user_id: UUID,
      resource_type: "parking",
    });

    expect(result.success).toBe(false);
  });

  it("bloquea asignación si el usuario objetivo es de otra sede activa", async () => {
    vi.mocked(getActiveEntityId).mockResolvedValueOnce("ent-1");

    // 1. select spot (entityId = ent-1, same as active)
    setupSelectMock([{ entityId: "ent-1" }]);
    // 2. select profile (entityId = ent-2, different)
    setupSelectMock([{ entityId: "ent-2" }]);

    const result = await assignUserToSpot({
      spot_id: UUID2,
      user_id: UUID,
      resource_type: "office",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain(
        "Este usuario no pertenece a la sede activa"
      );
    }
  });
});

// ─── deleteUser ───────────────────────────────────────────────────────────────

describe("deleteUser", () => {
  beforeEach(() => {
    resetDbMocks();
    setupAdminUser();
  });

  it("elimina el usuario con éxito", async () => {
    // delete users table
    setupDeleteMock([{ id: UUID }]);

    const result = await deleteUser({ user_id: UUID });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ deleted: true });
  });

  it("falla si la BD devuelve rows vacías (usuario no encontrado)", async () => {
    // delete returns empty rows → user not found
    setupDeleteMock([]);

    const result = await deleteUser({ user_id: UUID });

    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error).toContain("Usuario no encontrado");
  });

  it("falla si la BD lanza error", async () => {
    mockDb.delete.mockImplementationOnce(() => {
      throw new Error("User not found");
    });

    const result = await deleteUser({ user_id: UUID });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("User not found");
  });

  it("rechaza user_id no UUID sin llamar al admin client", async () => {
    const result = await deleteUser({ user_id: "not-a-uuid" });

    expect(result.success).toBe(false);
    expect(mockDb.delete).not.toHaveBeenCalled();
  });
});
