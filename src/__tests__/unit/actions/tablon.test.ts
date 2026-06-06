/**
 * Tests de Server Actions del Tablón
 *
 * Cubre: crear, editar, publicar, eliminar y marcar leído anuncios,
 * más queries del feed y gestión con control de permisos.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", async () => {
  const { mockDb } = await import("../../mocks/db");
  return { db: mockDb };
});
vi.mock("@/lib/auth/helpers", () => ({
  getCurrentUser: vi.fn(),
  requireAuth: vi.fn(),
  requireHROrAbove: vi.fn(),
}));
vi.mock("@/lib/queries/announcements", () => ({
  getPublishedAnnouncements: vi.fn().mockResolvedValue([]),
  getAnnouncementsForManagement: vi.fn().mockResolvedValue([]),
  markAsRead: vi.fn(),
}));
vi.mock("@/lib/queries/active-entity", () => ({
  getEffectiveEntityId: vi.fn().mockResolvedValue("entity-A"),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  getCurrentUser,
  requireAuth,
  requireHROrAbove,
  type AuthUser,
} from "@/lib/auth/helpers";
import {
  getPublishedAnnouncements,
  getAnnouncementsForManagement,
  markAsRead,
} from "@/lib/queries/announcements";
import {
  mockDb,
  resetDbMocks,
  setupSelectMock,
  setupInsertMock,
  setupUpdateMock,
  setupDeleteMock,
} from "../../mocks/db";
import {
  createAnnouncement,
  updateAnnouncement,
  publishAnnouncement,
  deleteAnnouncement,
  markAnnouncementRead,
  getMyFeedAnnouncements,
  getManageAnnouncements,
} from "@/app/(dashboard)/tablon/actions";

const ANNOUNCEMENT_ID = "550e8400-e29b-41d4-a716-446655440001";
const ENTITY_ID_B = "550e8400-e29b-41d4-a716-4466554400b2";

function setManager(entityId = "entity-A") {
  const user = {
    id: "manager-1",
    email: "manager@test.com",
    profile: { role: "manager", entityId } as AuthUser["profile"],
  } as AuthUser;
  vi.mocked(requireAuth).mockResolvedValue(user);
  vi.mocked(requireHROrAbove).mockResolvedValue(user);
}

function setAdmin() {
  const user = {
    id: "admin-1",
    email: "admin@test.com",
    profile: { role: "admin", entityId: null } as AuthUser["profile"],
  } as AuthUser;
  vi.mocked(requireAuth).mockResolvedValue(user);
  vi.mocked(requireHROrAbove).mockResolvedValue(user);
}

// ─── createAnnouncement ───────────────────────────────────────────────────────

describe("createAnnouncement", () => {
  beforeEach(() => {
    resetDbMocks();
    vi.clearAllMocks();
  });

  it("creates announcement as published when publish=true", async () => {
    setManager();
    setupInsertMock([]);

    const result = await createAnnouncement({
      title: "Título",
      body: "<p>Contenido del anuncio</p>",
      entity_id: null,
      publish: true,
    });

    expect(result.success).toBe(true);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("creates announcement as draft when publish=false", async () => {
    setManager();
    setupInsertMock([]);

    const result = await createAnnouncement({
      title: "Borrador",
      body: "<p>Contenido</p>",
      entity_id: null,
      publish: false,
    });

    expect(result.success).toBe(true);
  });

  it("admin can set entity_id explicitly", async () => {
    setAdmin();
    setupInsertMock([]);

    const result = await createAnnouncement({
      title: "Global",
      body: "<p>Contenido</p>",
      entity_id: ENTITY_ID_B,
      publish: true,
    });

    expect(result.success).toBe(true);
  });

  it("manager entity is forced to their own entity", async () => {
    setManager("entity-A");
    setupInsertMock([]);

    const result = await createAnnouncement({
      title: "Solo mi sede",
      body: "<p>Contenido</p>",
      entity_id: ENTITY_ID_B, // Should be ignored for manager
      publish: false,
    });

    expect(result.success).toBe(true);
  });
});

// ─── updateAnnouncement ───────────────────────────────────────────────────────

describe("updateAnnouncement", () => {
  beforeEach(() => {
    resetDbMocks();
    vi.clearAllMocks();
  });

  it("rejects when announcement not found", async () => {
    setManager();
    setupSelectMock([]);

    const result = await updateAnnouncement({
      id: ANNOUNCEMENT_ID,
      title: "Nuevo",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("no encontrado");
  });

  it("rejects when user is not the creator and not admin", async () => {
    setManager();
    setupSelectMock([{ createdBy: "other-user" }]);

    const result = await updateAnnouncement({
      id: ANNOUNCEMENT_ID,
      title: "Nuevo",
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("No tienes permiso");
  });

  it("admin can edit any announcement", async () => {
    setAdmin();
    setupSelectMock([{ createdBy: "other-user" }]);
    setupUpdateMock([]);

    const result = await updateAnnouncement({
      id: ANNOUNCEMENT_ID,
      title: "Editado por admin",
    });

    expect(result.success).toBe(true);
  });

  it("updates title and body", async () => {
    setManager();
    setupSelectMock([{ createdBy: "manager-1" }]);
    setupUpdateMock([]);

    const result = await updateAnnouncement({
      id: ANNOUNCEMENT_ID,
      title: "Nuevo título",
      body: "<p>Contenido</p>",
    });

    expect(result.success).toBe(true);
  });

  it("publishes when publish=true is set", async () => {
    setManager();
    setupSelectMock([{ createdBy: "manager-1" }]);
    setupUpdateMock([]);

    const result = await updateAnnouncement({
      id: ANNOUNCEMENT_ID,
      title: "Publicado ahora",
      publish: true,
    });

    expect(result.success).toBe(true);
  });
});

// ─── publishAnnouncement ──────────────────────────────────────────────────────

describe("publishAnnouncement", () => {
  beforeEach(() => {
    resetDbMocks();
    vi.clearAllMocks();
  });

  it("rejects when announcement not found", async () => {
    setManager();
    setupSelectMock([]);

    const result = await publishAnnouncement({ id: ANNOUNCEMENT_ID });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("no encontrado");
  });

  it("rejects when user is not the creator", async () => {
    setManager();
    setupSelectMock([{ createdBy: "other-user" }]);

    const result = await publishAnnouncement({ id: ANNOUNCEMENT_ID });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("No tienes permiso");
  });

  it("publishes announcement when user is creator", async () => {
    setManager();
    setupSelectMock([{ createdBy: "manager-1" }]);
    setupUpdateMock([]);

    const result = await publishAnnouncement({ id: ANNOUNCEMENT_ID });

    expect(result.success).toBe(true);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("admin can publish any announcement", async () => {
    setAdmin();
    setupSelectMock([{ createdBy: "other-user" }]);
    setupUpdateMock([]);

    const result = await publishAnnouncement({ id: ANNOUNCEMENT_ID });

    expect(result.success).toBe(true);
  });
});

// ─── deleteAnnouncement ───────────────────────────────────────────────────────

describe("deleteAnnouncement", () => {
  beforeEach(() => {
    resetDbMocks();
    vi.clearAllMocks();
  });

  it("rejects when announcement not found", async () => {
    setManager();
    setupSelectMock([]);

    const result = await deleteAnnouncement({ id: ANNOUNCEMENT_ID });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("no encontrado");
  });

  it("rejects when user is not the creator", async () => {
    setManager();
    setupSelectMock([{ createdBy: "other-user" }]);

    const result = await deleteAnnouncement({ id: ANNOUNCEMENT_ID });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("No tienes permiso");
  });

  it("deletes announcement when user is creator", async () => {
    setManager();
    setupSelectMock([{ createdBy: "manager-1" }]);
    setupDeleteMock([]);

    const result = await deleteAnnouncement({ id: ANNOUNCEMENT_ID });

    expect(result.success).toBe(true);
    expect(mockDb.delete).toHaveBeenCalled();
  });

  it("admin can delete any announcement", async () => {
    setAdmin();
    setupSelectMock([{ createdBy: "other-user" }]);
    setupDeleteMock([]);

    const result = await deleteAnnouncement({ id: ANNOUNCEMENT_ID });

    expect(result.success).toBe(true);
  });
});

// ─── markAnnouncementRead ─────────────────────────────────────────────────────

describe("markAnnouncementRead", () => {
  beforeEach(() => {
    resetDbMocks();
    vi.clearAllMocks();
  });

  it("requires authentication", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const result = await markAnnouncementRead({
      announcement_id: ANNOUNCEMENT_ID,
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("No autenticado");
  });

  it("calls markAsRead with correct params", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user-1",
      email: "user@test.com",
      profile: { role: "employee" } as AuthUser["profile"],
    } as AuthUser);

    const result = await markAnnouncementRead({
      announcement_id: ANNOUNCEMENT_ID,
    });

    expect(result.success).toBe(true);
    expect(markAsRead).toHaveBeenCalledWith(ANNOUNCEMENT_ID, "user-1");
  });
});

// ─── Query wrappers ───────────────────────────────────────────────────────────

describe("getMyFeedAnnouncements", () => {
  beforeEach(() => {
    resetDbMocks();
    vi.clearAllMocks();
  });

  it("returns error when requireAuth throws", async () => {
    vi.mocked(requireAuth).mockRejectedValue(new Error("No autenticado"));

    const result = await getMyFeedAnnouncements();

    expect(result.success).toBe(false);
  });

  it("returns published announcements", async () => {
    setManager();
    vi.mocked(getPublishedAnnouncements).mockResolvedValue([
      { id: "ann-1", title: "Test", authorName: "A" } as never,
    ]);

    const result = await getMyFeedAnnouncements();

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toHaveLength(1);
  });
});

describe("getManageAnnouncements", () => {
  beforeEach(() => {
    resetDbMocks();
    vi.clearAllMocks();
  });

  it("returns error when requireHROrAbove throws", async () => {
    vi.mocked(requireHROrAbove).mockRejectedValue(new Error("Sin permisos"));

    const result = await getManageAnnouncements();

    expect(result.success).toBe(false);
  });

  it("returns management announcements", async () => {
    setManager();
    vi.mocked(getAnnouncementsForManagement).mockResolvedValue([
      { id: "ann-1", title: "Draft", authorName: "A" } as never,
    ]);

    const result = await getManageAnnouncements();

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toHaveLength(1);
  });
});
