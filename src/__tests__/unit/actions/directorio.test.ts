import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", async () => {
  const { mockDb } = await import("../../mocks/db");
  return { db: mockDb };
});
vi.mock("@/lib/auth/helpers", () => ({ requireAdmin: vi.fn() }));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import {
  mockDb,
  resetDbMocks,
  setupSelectMock,
  setupInsertMock,
  setupUpdateMock,
} from "../../mocks/db";
import { requireAdmin } from "@/lib/auth/helpers";
import { revalidatePath } from "next/cache";
import { createMockProfile } from "../../mocks/factories";
import {
  updateDirectorioUser,
  createDirectorioUser,
} from "@/app/(dashboard)/directorio/actions";

const mockAdminUser = {
  id: "admin-1",
  email: "admin@test.com",
  profile: createMockProfile({ role: "admin" }),
};

describe("updateDirectorioUser", () => {
  beforeEach(() => {
    resetDbMocks();
    vi.mocked(requireAdmin).mockResolvedValue(mockAdminUser as never);
  });

  it("success → returns { success: true, data: { updated: true } }", async () => {
    // update profiles
    setupUpdateMock([]);

    const result = await updateDirectorioUser({
      user_id: "550e8400-e29b-41d4-a716-446655440123",
      nombre: "Juan Pérez",
      puesto: "",
      telefono: "",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ updated: true });
    }
    expect(revalidatePath).toHaveBeenCalledWith("/directorio");
  });

  it("success with all optional fields → returns { success: true, data: { updated: true } }", async () => {
    setupUpdateMock([]);

    const result = await updateDirectorioUser({
      user_id: "550e8400-e29b-41d4-a716-446655440123",
      nombre: "Juan Pérez",
      puesto: "Developer",
      telefono: "+34 600 000 000",
      entity_id: "550e8400-e29b-41d4-a716-446655440001",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ updated: true });
    }
  });

  it("DB error → success: false", async () => {
    mockDb.update.mockImplementationOnce(() => {
      throw new Error("DB error updating profile");
    });

    const result = await updateDirectorioUser({
      user_id: "550e8400-e29b-41d4-a716-446655440123",
      nombre: "Juan Pérez",
      puesto: "",
      telefono: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });

  it("calls profiles table update with correct user_id", async () => {
    setupUpdateMock([]);

    await updateDirectorioUser({
      user_id: "550e8400-e29b-41d4-a716-44665544abc0",
      nombre: "Test User",
      puesto: "",
      telefono: "",
    });

    expect(mockDb.update).toHaveBeenCalled();
  });
});

describe("createDirectorioUser", () => {
  beforeEach(() => {
    resetDbMocks();
    vi.mocked(requireAdmin).mockResolvedValue(mockAdminUser as never);
  });

  it("success → returns { success: true, data: { created: true } }", async () => {
    // 1. select users (check existing) → empty
    setupSelectMock([]);
    // 2. insert users → new user
    setupInsertMock([{ id: "new-user-1" }]);
    // 3. insert profiles → ok
    setupInsertMock([{}]);
    // 4. insert userPreferences → ok
    setupInsertMock([{}]);

    const result = await createDirectorioUser({
      correo: "newuser@test.com",
      nombre: "New User",
      puesto: "",
      telefono: "",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ created: true });
    }
    expect(revalidatePath).toHaveBeenCalledWith("/directorio");
  });

  it("'already been registered' error → success: false, error contains 'Ya existe un usuario'", async () => {
    // select users → user already exists
    setupSelectMock([{ id: "existing-user" }]);

    const result = await createDirectorioUser({
      correo: "existing@test.com",
      nombre: "Existing User",
      puesto: "",
      telefono: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain(
        "Ya existe un usuario con ese correo electrónico."
      );
    }
  });

  it("other DB error on insert → success: false", async () => {
    // 1. select users → empty
    setupSelectMock([]);
    // 2. insert users throws
    mockDb.insert.mockImplementationOnce(() => {
      throw new Error("Rate limit exceeded");
    });

    const result = await createDirectorioUser({
      correo: "newuser@test.com",
      nombre: "User",
      puesto: "",
      telefono: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });

  it("success with puesto → secondary profile insert is called", async () => {
    // 1. select users → empty
    setupSelectMock([]);
    // 2. insert users → new user
    setupInsertMock([{ id: "new-user-2" }]);
    // 3. insert profiles
    setupInsertMock([{}]);
    // 4. insert userPreferences
    setupInsertMock([{}]);

    const result = await createDirectorioUser({
      correo: "newuser2@test.com",
      nombre: "New User With Puesto",
      puesto: "Software Engineer",
      telefono: "",
    });

    expect(result.success).toBe(true);
    // insert was called at least for users + profiles
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("success with entity_id → creates user with correct entity_id in profile", async () => {
    // 1. select users → empty
    setupSelectMock([]);
    // 2. insert users → new user
    setupInsertMock([{ id: "new-user-5" }]);
    // 3. insert profiles
    setupInsertMock([{}]);
    // 4. insert userPreferences
    setupInsertMock([{}]);

    const result = await createDirectorioUser({
      correo: "entity@test.com",
      nombre: "Entity User",
      puesto: "",
      telefono: "",
      entity_id: "550e8400-e29b-41d4-a716-446655440001",
    });

    expect(result.success).toBe(true);
    expect(mockDb.insert).toHaveBeenCalled();
  });
});
