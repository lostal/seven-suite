import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/config", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", async () => {
  const { mockDb } = await import("../../mocks/db");
  return { db: mockDb };
});
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("REDIRECT");
  }),
}));
vi.mock("@/lib/constants", () => ({
  ROUTES: {
    LOGIN: "/login",
    PARKING: "/parking",
    OFFICES: "/oficinas",
  },
}));

import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { mockDb, resetDbMocks, setupSelectMock } from "../../mocks/db";
import {
  getCurrentUser,
  requireAuth,
  requireAdmin,
  requireHR,
  requireManagerOrAbove,
  requireSpotOwner,
} from "@/lib/auth/helpers";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockSession(userId: string, email: string) {
  vi.mocked(auth).mockResolvedValue({
    user: { id: userId, email },
  } as never);
}

function mockNoSession() {
  vi.mocked(auth).mockResolvedValue(null as never);
}

function mockProfile(
  id: string,
  role: "employee" | "manager" | "hr" | "admin"
) {
  setupSelectMock([
    {
      id,
      email: "test@example.com",
      fullName: "Test User",
      role,
      avatarUrl: null,
      dni: null,
      entityId: null,
      jobTitle: null,
      location: null,
      managerId: null,
      phone: null,
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-01"),
    },
  ]);
}

function mockNoProfile() {
  setupSelectMock([]);
}

// ─── getCurrentUser ────────────────────────────────────────────────────────────

describe("getCurrentUser", () => {
  beforeEach(() => {
    resetDbMocks();
  });

  it("no session → returns null", async () => {
    mockNoSession();
    const result = await getCurrentUser();
    expect(result).toBeNull();
  });

  it("user with profile → returns AuthUser with id, email, profile", async () => {
    mockSession("user-123", "test@example.com");
    mockProfile("user-123", "employee");

    const result = await getCurrentUser();
    expect(result).not.toBeNull();
    expect(result?.id).toBe("user-123");
    expect(result?.email).toBe("test@example.com");
    expect(result?.profile?.role).toBe("employee");
  });

  it("user with no profile → returns AuthUser with profile=null", async () => {
    mockSession("user-123", "test@example.com");
    mockNoProfile();

    const result = await getCurrentUser();
    expect(result).not.toBeNull();
    expect(result?.profile).toBeNull();
  });
});

// ─── requireAuth ──────────────────────────────────────────────────────────────

describe("requireAuth", () => {
  beforeEach(() => {
    resetDbMocks();
  });

  it("unauthenticated → calls redirect('/login')", async () => {
    mockNoSession();

    await expect(requireAuth()).rejects.toThrow("REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("authenticated → returns user", async () => {
    mockSession("user-123", "test@example.com");
    mockProfile("user-123", "employee");

    const user = await requireAuth();
    expect(user.id).toBe("user-123");
  });
});

// ─── requireAdmin ─────────────────────────────────────────────────────────────

describe("requireAdmin", () => {
  beforeEach(() => {
    resetDbMocks();
  });

  it("employee role → calls redirect('/parking')", async () => {
    mockSession("user-123", "test@example.com");
    mockProfile("user-123", "employee");

    await expect(requireAdmin()).rejects.toThrow("REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/parking");
  });

  it("hr role → calls redirect('/parking')", async () => {
    mockSession("user-123", "test@example.com");
    mockProfile("user-123", "hr");

    await expect(requireAdmin()).rejects.toThrow("REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/parking");
  });

  it("admin role → returns user", async () => {
    mockSession("user-123", "admin@example.com");
    mockProfile("user-123", "admin");

    const user = await requireAdmin();
    expect(user.id).toBe("user-123");
    expect(user.profile?.role).toBe("admin");
  });
});

// ─── requireHR ────────────────────────────────────────────────────────────────

describe("requireHR", () => {
  beforeEach(() => {
    resetDbMocks();
  });

  it("employee role → redirect('/parking')", async () => {
    mockSession("user-123", "test@example.com");
    mockProfile("user-123", "employee");

    await expect(requireHR()).rejects.toThrow("REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/parking");
  });

  it("manager role → redirect('/parking')", async () => {
    mockSession("user-123", "test@example.com");
    mockProfile("user-123", "manager");

    await expect(requireHR()).rejects.toThrow("REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/parking");
  });

  it("hr role → returns user", async () => {
    mockSession("user-123", "hr@example.com");
    mockProfile("user-123", "hr");

    const user = await requireHR();
    expect(user.profile?.role).toBe("hr");
  });

  it("admin role → returns user", async () => {
    mockSession("user-123", "admin@example.com");
    mockProfile("user-123", "admin");

    const user = await requireHR();
    expect(user.profile?.role).toBe("admin");
  });
});

// ─── requireManagerOrAbove ────────────────────────────────────────────────────

describe("requireManagerOrAbove", () => {
  beforeEach(() => {
    resetDbMocks();
  });

  it("employee role → redirect('/parking')", async () => {
    mockSession("user-123", "test@example.com");
    mockProfile("user-123", "employee");

    await expect(requireManagerOrAbove()).rejects.toThrow("REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/parking");
  });

  it("manager role → returns user", async () => {
    mockSession("user-123", "mgr@example.com");
    mockProfile("user-123", "manager");

    const user = await requireManagerOrAbove();
    expect(user.profile?.role).toBe("manager");
  });

  it("hr role → returns user", async () => {
    mockSession("user-123", "hr@example.com");
    mockProfile("user-123", "hr");

    const user = await requireManagerOrAbove();
    expect(user.profile?.role).toBe("hr");
  });

  it("admin role → returns user", async () => {
    mockSession("user-123", "admin@example.com");
    mockProfile("user-123", "admin");

    const user = await requireManagerOrAbove();
    expect(user.profile?.role).toBe("admin");
  });
});

// ─── requireSpotOwner ─────────────────────────────────────────────────────────

describe("requireSpotOwner", () => {
  beforeEach(() => {
    resetDbMocks();
  });

  it("admin role → bypasses spot check and returns user", async () => {
    mockSession("admin-1", "admin@example.com");
    mockProfile("admin-1", "admin");
    // No spot select should happen for admin

    const user = await requireSpotOwner("parking");
    expect(user.id).toBe("admin-1");
    // Only profile select was called, no second select for spots
    expect(mockDb.select).toHaveBeenCalledTimes(1);
  });

  it("employee with assigned parking spot → returns user", async () => {
    mockSession("user-1", "emp@example.com");
    mockProfile("user-1", "employee");
    setupSelectMock([{ id: "spot-1" }]); // spot exists

    const user = await requireSpotOwner("parking");
    expect(user.id).toBe("user-1");
  });

  it("employee without parking spot → redirect('/parking')", async () => {
    mockSession("user-1", "emp@example.com");
    mockProfile("user-1", "employee");
    setupSelectMock([]); // no spot

    await expect(requireSpotOwner("parking")).rejects.toThrow("REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/parking");
  });

  it("employee without office spot → redirect('/oficinas')", async () => {
    mockSession("user-1", "emp@example.com");
    mockProfile("user-1", "employee");
    setupSelectMock([]); // no spot

    await expect(requireSpotOwner("office")).rejects.toThrow("REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/oficinas");
  });

  it("employee with assigned office spot → returns user", async () => {
    mockSession("user-1", "emp@example.com");
    mockProfile("user-1", "employee");
    setupSelectMock([{ id: "office-spot-1" }]); // spot exists

    const user = await requireSpotOwner("office");
    expect(user.id).toBe("user-1");
  });
});
