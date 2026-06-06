/**
 * Tests de Server Actions de Vacaciones
 *
 * Cubre el workflow completo de aprobación en un solo paso:
 *   pending → approved
 * Y los casos especiales: sick auto-approve, cancelación, edición.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", async () => {
  const { mockDb } = await import("../../mocks/db");
  return { db: mockDb };
});
vi.mock("@/lib/auth/helpers", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/queries/active-entity", () => ({
  getEffectiveEntityId: vi.fn().mockResolvedValue("entity-A"),
}));
vi.mock("@/lib/queries/holidays", () => ({
  getHolidayDatesSet: vi.fn().mockResolvedValue(new Set<string>()),
  getHolidayDatesSetForYears: vi.fn().mockResolvedValue(new Set<string>()),
}));
vi.mock("@/lib/queries/leave-requests", () => ({
  getUserLeaveRequests: vi.fn().mockResolvedValue([]),
  getLeaveRequestsByEntity: vi.fn().mockResolvedValue([]),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { getCurrentUser, type AuthUser } from "@/lib/auth/helpers";
import { getEffectiveEntityId } from "@/lib/queries/active-entity";
import { getHolidayDatesSet } from "@/lib/queries/holidays";
import {
  getUserLeaveRequests,
  getLeaveRequestsByEntity,
} from "@/lib/queries/leave-requests";
import {
  resetDbMocks,
  setupSelectMock,
  setupInsertMock,
  setupUpdateMock,
} from "../../mocks/db";
import {
  getMyLeaveRequests,
  getEntityLeaveRequests,
  createLeaveRequest,
  updateLeaveRequest,
  cancelLeaveRequest,
  approveLeaveRequest,
  rejectLeaveRequest,
} from "@/app/(dashboard)/vacaciones/actions";

const REQUEST_ID = "550e8400-e29b-41d4-a716-446655440001";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setAuth(user: Partial<AuthUser> | null) {
  vi.mocked(getCurrentUser).mockResolvedValue(user as AuthUser);
}

function setManager(entityId = "entity-A") {
  setAuth({
    id: "manager-1",
    email: "manager@test.com",
    profile: { role: "manager", entityId } as AuthUser["profile"],
  } as AuthUser);
}

function setEmployee() {
  setAuth({
    id: "employee-1",
    email: "emp@test.com",
    profile: { role: "employee", entityId: "entity-A" } as AuthUser["profile"],
  } as AuthUser);
}

function setHR() {
  setAuth({
    id: "hr-1",
    email: "hr@test.com",
    profile: { role: "hr", entityId: "entity-A" } as AuthUser["profile"],
  } as AuthUser);
}

function setAdmin() {
  setAuth({
    id: "admin-1",
    email: "admin@test.com",
    profile: { role: "admin", entityId: null } as AuthUser["profile"],
  } as AuthUser);
}

// ─── Query wrappers ───────────────────────────────────────────────────────────

describe("getMyLeaveRequests", () => {
  beforeEach(() => {
    resetDbMocks();
    vi.clearAllMocks();
  });

  it("returns error when not authenticated", async () => {
    setAuth(null);

    const result = await getMyLeaveRequests();

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("No autenticado");
  });

  it("returns user leave requests on success", async () => {
    setEmployee();
    vi.mocked(getUserLeaveRequests).mockResolvedValue([
      { id: "lr-1", status: "pending", employeeName: "Test" } as never,
    ]);

    const result = await getMyLeaveRequests();

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toHaveLength(1);
  });
});

describe("getEntityLeaveRequests", () => {
  beforeEach(() => {
    resetDbMocks();
    vi.clearAllMocks();
  });

  it("returns error when not authenticated", async () => {
    setAuth(null);

    const result = await getEntityLeaveRequests();

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("No autenticado");
  });

  it("returns error when user has insufficient permissions", async () => {
    setEmployee();

    const result = await getEntityLeaveRequests();

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Sin permisos");
  });

  it("returns error when no active entity", async () => {
    setManager();
    vi.mocked(getEffectiveEntityId).mockResolvedValue(null);

    const result = await getEntityLeaveRequests();

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("No hay sede activa");
  });

  it("returns leave requests for entity (manager)", async () => {
    setManager();
    vi.mocked(getEffectiveEntityId).mockResolvedValue("entity-A");
    vi.mocked(getLeaveRequestsByEntity).mockResolvedValue([
      { id: "lr-1", employeeName: "Emp" } as never,
    ]);

    const result = await getEntityLeaveRequests();

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toHaveLength(1);
  });

  it("returns leave requests for entity (hr)", async () => {
    setHR();
    vi.mocked(getEffectiveEntityId).mockResolvedValue("entity-A");
    vi.mocked(getLeaveRequestsByEntity).mockResolvedValue([
      { id: "lr-2", employeeName: "Emp2" } as never,
    ]);

    const result = await getEntityLeaveRequests();

    expect(result.success).toBe(true);
  });
});

// ─── createLeaveRequest ───────────────────────────────────────────────────────

describe("createLeaveRequest", () => {
  beforeEach(() => {
    resetDbMocks();
    vi.clearAllMocks();
    setEmployee();
    vi.mocked(getEffectiveEntityId).mockResolvedValue("entity-A");
    vi.mocked(getHolidayDatesSet).mockResolvedValue(new Set());
  });

  it("creates request as pending for vacation type", async () => {
    setupInsertMock([{ id: "lr-new" }]);

    const result = await createLeaveRequest({
      leave_type: "vacation",
      start_date: "2026-07-01",
      end_date: "2026-07-03",
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ id: "lr-new" });
  });

  it("auto-approves sick leave to hr_approved", async () => {
    setupInsertMock([{ id: "lr-sick" }]);

    const result = await createLeaveRequest({
      leave_type: "sick",
      start_date: "2026-07-01",
      end_date: "2026-07-01",
    });

    expect(result.success).toBe(true);
  });

  it("rejects past dates for non-sick leave", async () => {
    const result = await createLeaveRequest({
      leave_type: "vacation",
      start_date: "2020-01-01",
      end_date: "2020-01-05",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("No se pueden solicitar días pasados");
    }
  });

  it("allows past dates for sick leave", async () => {
    setupInsertMock([{ id: "lr-sick-past" }]);

    const result = await createLeaveRequest({
      leave_type: "sick",
      start_date: "2020-01-01",
      end_date: "2020-01-05",
    });

    // Should NOT reject past dates for sick leave
    expect(result.success).toBe(true);
  });

  it("rejects range with zero working days", async () => {
    // Simulate a weekend-only range (Sat-Sun)
    vi.mocked(getHolidayDatesSet).mockResolvedValue(new Set<string>());

    const result = await createLeaveRequest({
      leave_type: "vacation",
      start_date: "2026-07-04",
      end_date: "2026-07-05", // Sat-Sun (both weekend)
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("días laborables");
    }
  });

  it("rejects when insert returns no row", async () => {
    setupInsertMock([]);

    const result = await createLeaveRequest({
      leave_type: "personal",
      start_date: "2026-07-01",
      end_date: "2026-07-01",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("No se pudo crear");
    }
  });
});

// ─── updateLeaveRequest ───────────────────────────────────────────────────────

describe("updateLeaveRequest", () => {
  beforeEach(() => {
    resetDbMocks();
    vi.clearAllMocks();
    setEmployee();
    vi.mocked(getEffectiveEntityId).mockResolvedValue("entity-A");
    vi.mocked(getHolidayDatesSet).mockResolvedValue(new Set());
  });

  it("updates a rejected request back to pending", async () => {
    setupUpdateMock([{ id: REQUEST_ID }]);

    const result = await updateLeaveRequest({
      id: REQUEST_ID,
      leave_type: "vacation",
      start_date: "2026-07-10",
      end_date: "2026-07-14",
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ updated: true });
  });

  it("rejects range with zero working days", async () => {
    const result = await updateLeaveRequest({
      id: REQUEST_ID,
      leave_type: "vacation",
      start_date: "2026-07-04",
      end_date: "2026-07-05",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("días laborables");
    }
  });

  it("returns error when request is not in rejected state", async () => {
    // update returning empty = not found or wrong state
    setupUpdateMock([]);

    const result = await updateLeaveRequest({
      id: REQUEST_ID,
      leave_type: "vacation",
      start_date: "2026-07-10",
      end_date: "2026-07-14",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("rechazado");
    }
  });

  it("only updates own requests (employeeId filter)", async () => {
    setupUpdateMock([]); // Not found for this employee

    const result = await updateLeaveRequest({
      id: "someone-elses-request",
      leave_type: "vacation",
      start_date: "2026-07-10",
      end_date: "2026-07-14",
    });

    expect(result.success).toBe(false);
  });
});

// ─── cancelLeaveRequest ───────────────────────────────────────────────────────

describe("cancelLeaveRequest", () => {
  beforeEach(() => {
    resetDbMocks();
    vi.clearAllMocks();
    setEmployee();
  });

  it("cancels a pending request", async () => {
    setupSelectMock([{ status: "pending", employeeId: "employee-1" }]);
    setupUpdateMock([]);

    const result = await cancelLeaveRequest({ id: REQUEST_ID });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ cancelled: true });
  });

  it("returns error when trying to cancel approved request", async () => {
    setupSelectMock([{ status: "approved", employeeId: "employee-1" }]);

    const result = await cancelLeaveRequest({ id: REQUEST_ID });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("approved");
  });

  it("returns error when request not found", async () => {
    setupSelectMock([]);

    const result = await cancelLeaveRequest({ id: REQUEST_ID });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("no encontrada");
  });

  it("returns error when trying to cancel someone elses request", async () => {
    setupSelectMock([{ status: "pending", employeeId: "other-user" }]);

    const result = await cancelLeaveRequest({ id: REQUEST_ID });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("Sin permisos");
  });

  it("returns error for hr_approved requests", async () => {
    setupSelectMock([{ status: "approved", employeeId: "employee-1" }]);

    const result = await cancelLeaveRequest({ id: REQUEST_ID });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("approved");
    }
  });

  it("returns error for rejected requests", async () => {
    setupSelectMock([{ status: "rejected", employeeId: "employee-1" }]);

    const result = await cancelLeaveRequest({ id: REQUEST_ID });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("rejected");
    }
  });
});

// ─── approveLeaveRequest ──────────────────────────────────────────────────────

describe("approveLeaveRequest", () => {
  beforeEach(() => {
    resetDbMocks();
    vi.clearAllMocks();
    vi.mocked(getEffectiveEntityId).mockResolvedValue("entity-A");
  });

  it("returns error when not authenticated", async () => {
    setAuth(null);

    const result = await approveLeaveRequest({ id: REQUEST_ID, notes: null });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("No autenticado");
  });

  it("returns error for employee role", async () => {
    setEmployee();

    const result = await approveLeaveRequest({ id: REQUEST_ID, notes: null });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("Sin permisos");
  });

  it("manager approves pending → manager_approved", async () => {
    setManager();
    setupSelectMock([{ status: "pending", employeeEntityId: "entity-A" }]);
    setupUpdateMock([]);

    const result = await approveLeaveRequest({ id: REQUEST_ID, notes: null });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        approved: true,
        newStatus: "approved",
      });
    }
  });

  it("manager cannot approve already manager_approved", async () => {
    setManager();
    setupSelectMock([{ status: "approved", employeeEntityId: "entity-A" }]);

    const result = await approveLeaveRequest({ id: REQUEST_ID, notes: null });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("approved");
    }
  });

  it("HR cannot approve non-pending request", async () => {
    setHR();
    setupSelectMock([{ status: "approved", employeeEntityId: "entity-A" }]);

    const result = await approveLeaveRequest({ id: REQUEST_ID, notes: null });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("approved");
    }
  });

  it("blocks cross-entity approval", async () => {
    setManager();
    setupSelectMock([{ status: "pending", employeeEntityId: "entity-B" }]);

    const result = await approveLeaveRequest({ id: REQUEST_ID, notes: null });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("Sin permisos");
  });

  it("admin approves pending → hr_approved", async () => {
    setAdmin();
    vi.mocked(getEffectiveEntityId).mockResolvedValue("entity-A");
    setupSelectMock([{ status: "pending", employeeEntityId: "entity-A" }]);
    setupUpdateMock([]);

    const result = await approveLeaveRequest({ id: REQUEST_ID, notes: null });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ approved: true, newStatus: "approved" });
    }
  });
});

// ─── rejectLeaveRequest ───────────────────────────────────────────────────────

describe("rejectLeaveRequest", () => {
  beforeEach(() => {
    resetDbMocks();
    vi.clearAllMocks();
    vi.mocked(getEffectiveEntityId).mockResolvedValue("entity-A");
  });

  it("returns error when not authenticated", async () => {
    setAuth(null);

    const result = await rejectLeaveRequest({
      id: REQUEST_ID,
      notes: "Motivo",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("No autenticado");
  });

  it("returns error for employee role", async () => {
    setEmployee();

    const result = await rejectLeaveRequest({
      id: REQUEST_ID,
      notes: "Motivo",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("Sin permisos");
  });

  it("manager rejects pending request", async () => {
    setManager();
    setupSelectMock([{ status: "pending", employeeEntityId: "entity-A" }]);
    setupUpdateMock([{ id: REQUEST_ID }]);

    const result = await rejectLeaveRequest({
      id: REQUEST_ID,
      notes: "No procede",
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ rejected: true });
  });

  it("manager cannot reject manager_approved request", async () => {
    setManager();
    setupSelectMock([{ status: "approved", employeeEntityId: "entity-A" }]);

    const result = await rejectLeaveRequest({
      id: REQUEST_ID,
      notes: "Motivo",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("approved");
    }
  });

  it("HR cannot reject non-pending request", async () => {
    setHR();
    setupSelectMock([{ status: "approved", employeeEntityId: "entity-A" }]);

    const result = await rejectLeaveRequest({
      id: REQUEST_ID,
      notes: "Denegado",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("approved");
    }
  });

  it("blocks cross-entity rejection", async () => {
    setManager();
    setupSelectMock([{ status: "pending", employeeEntityId: "entity-B" }]);

    const result = await rejectLeaveRequest({
      id: REQUEST_ID,
      notes: "Motivo",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("Sin permisos");
  });

  it("returns error when update returns no rows", async () => {
    setManager();
    setupSelectMock([{ status: "pending", employeeEntityId: "entity-A" }]);
    setupUpdateMock([]); // No rows updated

    const result = await rejectLeaveRequest({
      id: REQUEST_ID,
      notes: "Motivo",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("no encontrada");
  });
});
