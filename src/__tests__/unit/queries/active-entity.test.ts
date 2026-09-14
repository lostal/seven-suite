import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));
vi.mock("@/lib/auth/helpers", () => ({
  getCurrentUser: vi.fn(),
}));
vi.mock("@/lib/db", async () => {
  const { mockDb } = await import("../../mocks/db");
  return { db: mockDb };
});

import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth/helpers";
import { resetDbMocks, setupSelectMock } from "../../mocks/db";
import {
  getActiveEntityId,
  getEffectiveEntityId,
} from "@/lib/queries/active-entity";

type CookieStore = Awaited<ReturnType<typeof cookies>>;

function mockCookieStore(entityId: string | undefined): CookieStore {
  return {
    get: vi.fn((name: string) =>
      name === "active-entity-id" && entityId !== undefined
        ? { value: entityId }
        : undefined
    ),
  } as unknown as CookieStore;
}

describe("getActiveEntityId", () => {
  beforeEach(() => {
    resetDbMocks();
    vi.clearAllMocks();
  });

  it("cookie exists → returns its value", async () => {
    vi.mocked(cookies).mockResolvedValue(mockCookieStore("entity-123"));

    const result = await getActiveEntityId();
    expect(result).toBe("entity-123");
  });

  it("cookie missing → returns null", async () => {
    vi.mocked(cookies).mockResolvedValue(mockCookieStore(undefined));
    setupSelectMock([{ id: "ent-789" }]);

    const result = await getActiveEntityId();
    expect(result).toBeNull();
  });

  it("different cookie name → returns null", async () => {
    const store = {
      get: vi.fn((name: string) =>
        name === "other-cookie" ? { value: "some-value" } : undefined
      ),
    } as unknown as CookieStore;
    vi.mocked(cookies).mockResolvedValue(store);

    const result = await getActiveEntityId();
    expect(result).toBeNull();
  });
});

describe("getEffectiveEntityId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no user (unauthenticated) → returns null", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    vi.mocked(cookies).mockResolvedValue(mockCookieStore(undefined));

    const result = await getEffectiveEntityId();
    expect(result).toBeNull();
  });

  it("admin with cookie → returns cookie value", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "admin-1",
      email: "admin@test.com",
      profile: { role: "admin", entityId: null } as never,
    });
    vi.mocked(cookies).mockResolvedValue(mockCookieStore("entity-456"));
    setupSelectMock([{ id: "entity-456" }]);

    const result = await getEffectiveEntityId();
    expect(result).toBe("entity-456");
  });

  it("admin without cookie → returns null", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "admin-1",
      email: "admin@test.com",
      profile: { role: "admin", entityId: null } as never,
    });
    vi.mocked(cookies).mockResolvedValue(mockCookieStore(undefined));

    const result = await getEffectiveEntityId();
    expect(result).toBeNull();
  });

  it("employee with entityId → returns entityId from profile", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user-1",
      email: "emp@test.com",
      profile: { role: "employee", entityId: "ent-789" } as never,
    });
    vi.mocked(cookies).mockResolvedValue(mockCookieStore(undefined));
    setupSelectMock([{ id: "ent-789" }]);

    const result = await getEffectiveEntityId();
    expect(result).toBe("ent-789");
  });

  it("employee without entityId → returns null", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user-1",
      email: "emp@test.com",
      profile: { role: "employee", entityId: null } as never,
    });
    vi.mocked(cookies).mockResolvedValue(mockCookieStore(undefined));

    const result = await getEffectiveEntityId();
    expect(result).toBeNull();
  });

  it("employee ignores cookie, uses profile entityId instead", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user-1",
      email: "emp@test.com",
      profile: { role: "employee", entityId: "ent-from-profile" } as never,
    });
    // Cookie is set but should be ignored for non-admin users
    vi.mocked(cookies).mockResolvedValue(mockCookieStore("ent-from-cookie"));
    setupSelectMock([{ id: "ent-from-profile" }]);

    const result = await getEffectiveEntityId();
    expect(result).toBe("ent-from-profile");
  });

  it("user with null profile → returns null", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user-1",
      email: "test@test.com",
      profile: null,
    });
    vi.mocked(cookies).mockResolvedValue(mockCookieStore(undefined));

    const result = await getEffectiveEntityId();
    expect(result).toBeNull();
  });

  it("hr role with entityId → returns entityId from profile (non-admin path)", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "hr-1",
      email: "hr@test.com",
      profile: { role: "hr", entityId: "ent-hr" } as never,
    });
    vi.mocked(cookies).mockResolvedValue(mockCookieStore(undefined));
    setupSelectMock([{ id: "ent-hr" }]);

    const result = await getEffectiveEntityId();
    expect(result).toBe("ent-hr");
  });
});
