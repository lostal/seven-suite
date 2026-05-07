/**
 * Tests de Onboarding Actions
 *
 * Verifica:
 * - Validación de entrada (entityId obligatorio como UUID)
 * - Actualización del perfil con entityId y phone
 * - Redirección según rol (admin → panel, employee → parking)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDb, resetDbMocks } from "../../mocks/db";

vi.mock("@/lib/db", async () => {
  const { mockDb } = await import("../../mocks/db");
  return { db: mockDb };
});

vi.mock("@/lib/auth/helpers", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((_url: string) => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

import { requireAuth, type AuthUser } from "@/lib/auth/helpers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { completeOnboarding } from "@/app/onboarding/actions";

function setupAuthUser(role = "employee") {
  vi.mocked(requireAuth).mockResolvedValue({
    id: "user-00000000-0000-0000-0000-000000000001",
    email: "test@example.com",
    profile: { role } as AuthUser["profile"],
  } as AuthUser);
}

describe("completeOnboarding", () => {
  beforeEach(() => {
    resetDbMocks();
    vi.clearAllMocks();
  });

  it("rejects when entityId is missing", async () => {
    const result = await completeOnboarding({
      phone: "600000000",
    } as never);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Datos inválidos");
    }
  });

  it("rejects when entityId is not a UUID", async () => {
    const result = await completeOnboarding({
      entityId: "not-a-uuid",
    } as never);

    expect(result.success).toBe(false);
  });

  it("calls requireAuth to get current user", async () => {
    setupAuthUser();

    await expect(
      completeOnboarding({
        entityId: "550e8400-e29b-41d4-a716-446655440000",
      })
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(requireAuth).toHaveBeenCalledTimes(1);
  });

  it("updates profile with entityId and phone", async () => {
    setupAuthUser("employee");

    await expect(
      completeOnboarding({
        entityId: "550e8400-e29b-41d4-a716-446655440000",
        phone: "600111222",
      })
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockDb.update).toHaveBeenCalledTimes(1);
    // Check set values
    const builder = vi.mocked(mockDb.update).mock.results[0]?.value;
    expect(builder.set).toHaveBeenCalled();
    const setArgs = vi.mocked(builder.set).mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(setArgs.entityId).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(setArgs.phone).toBe("600111222");
  });

  it("stores null phone when phone is not provided", async () => {
    setupAuthUser();

    await expect(
      completeOnboarding({
        entityId: "550e8400-e29b-41d4-a716-446655440000",
      })
    ).rejects.toThrow("NEXT_REDIRECT");

    const builder = vi.mocked(mockDb.update).mock.results[0]?.value;
    const setArgs = vi.mocked(builder.set).mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(setArgs.phone).toBeNull();
  });

  it("calls revalidatePath with root layout", async () => {
    setupAuthUser();

    await expect(
      completeOnboarding({
        entityId: "550e8400-e29b-41d4-a716-446655440000",
      })
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("redirects admin to dashboard", async () => {
    setupAuthUser("admin");

    await expect(
      completeOnboarding({
        entityId: "550e8400-e29b-41d4-a716-446655440000",
      })
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/panel");
  });

  it("redirects employee to parking", async () => {
    setupAuthUser("employee");

    await expect(
      completeOnboarding({
        entityId: "550e8400-e29b-41d4-a716-446655440000",
      })
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/parking");
  });

  it("redirects manager to parking", async () => {
    setupAuthUser("manager");

    await expect(
      completeOnboarding({
        entityId: "550e8400-e29b-41d4-a716-446655440000",
      })
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/parking");
  });

  it("stores false hasFixedParking as null (not stored in DB)", async () => {
    // The schema only stores entityId, phone, updatedAt
    // hasFixedParking and hasFixedOffice are accepted by Zod but not persisted
    setupAuthUser();

    await expect(
      completeOnboarding({
        entityId: "550e8400-e29b-41d4-a716-446655440000",
        hasFixedParking: true,
        hasFixedOffice: false,
      })
    ).rejects.toThrow("NEXT_REDIRECT");

    const builder = vi.mocked(mockDb.update).mock.results[0]?.value;
    const setArgs = vi.mocked(builder.set).mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    // These are NOT in the set object
    expect(setArgs.hasFixedParking).toBeUndefined();
    expect(setArgs.hasFixedOffice).toBeUndefined();
    expect(setArgs.entityId).toBeDefined();
  });
});
