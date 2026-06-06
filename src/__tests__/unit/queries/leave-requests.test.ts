/**
 * Tests de Leave Request Queries
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDb, resetDbMocks, setupSelectMock } from "../../mocks/db";

vi.mock("@/lib/db", async () => {
  const { mockDb } = await import("../../mocks/db");
  return { db: mockDb };
});

import {
  getUserLeaveRequests,
  getLeaveRequestsByEntity,
  countPendingByEntity,
} from "@/lib/queries/leave-requests";

const MOCK_ROWS = [
  {
    id: "lr-1",
    leaveType: "vacation",
    startDate: "2026-07-01",
    endDate: "2026-07-14",
    status: "pending",
    reason: "Vacaciones verano",
    workingDays: 10,
    createdAt: new Date("2026-06-01"),
    employeeId: "user-1",
    employeeName: "Ana García",
    managerId: null,
    managerNotes: null,
    hrId: null,
    hrNotes: null,
  },
  {
    id: "lr-2",
    leaveType: "sick",
    startDate: "2026-06-15",
    endDate: "2026-06-16",
    status: "hr_approved",
    reason: null,
    workingDays: 2,
    createdAt: new Date("2026-06-10"),
    employeeId: "user-1",
    employeeName: "Ana García",
    managerId: null,
    managerNotes: null,
    hrId: null,
    hrNotes: null,
  },
];

describe("getUserLeaveRequests", () => {
  beforeEach(() => {
    resetDbMocks();
    vi.clearAllMocks();
  });

  it("returns leave requests for a user", async () => {
    setupSelectMock(MOCK_ROWS);

    const result = await getUserLeaveRequests("user-1");

    expect(result).toHaveLength(2);
    expect(result[0]?.employeeName).toBe("Ana García");
    expect(mockDb.select).toHaveBeenCalledTimes(1);
  });

  it("returns empty array for user with no requests", async () => {
    setupSelectMock([]);

    const result = await getUserLeaveRequests("user-new");

    expect(result).toHaveLength(0);
  });

  it("maps null employeeName to empty string", async () => {
    setupSelectMock([{ ...MOCK_ROWS[0]!, employeeName: null }]);

    const result = await getUserLeaveRequests("user-1");

    expect(result[0]?.employeeName).toBe("");
  });

  it("returns empty array when user has no requests", async () => {
    setupSelectMock([]);

    const result = await getUserLeaveRequests("user-1");

    expect(result).toEqual([]);
  });
});

describe("getLeaveRequestsByEntity", () => {
  beforeEach(() => {
    resetDbMocks();
    vi.clearAllMocks();
  });

  it("returns requests for entity without status filter", async () => {
    setupSelectMock(MOCK_ROWS);

    const result = await getLeaveRequestsByEntity("entity-A");

    expect(result).toHaveLength(2);
  });

  it("filters by status when provided", async () => {
    setupSelectMock([MOCK_ROWS[0]!]);

    const result = await getLeaveRequestsByEntity("entity-A", "pending");

    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe("pending");
  });

  it("returns empty for entity with no requests", async () => {
    setupSelectMock([]);

    const result = await getLeaveRequestsByEntity("entity-empty");

    expect(result).toHaveLength(0);
  });
});

describe("countPendingByEntity", () => {
  beforeEach(() => {
    resetDbMocks();
    vi.clearAllMocks();
  });

  it("returns count of pending requests", async () => {
    setupSelectMock([{ id: "lr-1" }, { id: "lr-2" }, { id: "lr-3" }]);

    const result = await countPendingByEntity("entity-A");

    expect(result).toBe(3);
  });

  it("returns zero when no pending requests", async () => {
    setupSelectMock([]);

    const result = await countPendingByEntity("entity-A");

    expect(result).toBe(0);
  });
});
