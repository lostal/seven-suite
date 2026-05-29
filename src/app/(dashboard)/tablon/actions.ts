"use server";

import { revalidatePath } from "next/cache";
import { actionClient, type ActionResult } from "@/lib/actions";
import { db } from "@/lib/db";
import { announcements } from "@/lib/db/schema";
import {
  getCurrentUser,
  requireAuth,
  requireManagerOrAbove,
} from "@/lib/auth/helpers";
import {
  createAnnouncementSchema,
  updateAnnouncementSchema,
  publishAnnouncementSchema,
  deleteAnnouncementSchema,
  markAnnouncementReadSchema,
} from "@/lib/validations";
import {
  getPublishedAnnouncements,
  getAnnouncementsForManagement,
  markAsRead,
  type AnnouncementWithAuthor,
} from "@/lib/queries/announcements";
import { getEffectiveEntityId } from "@/lib/queries/active-entity";
import { eq, and } from "drizzle-orm";

// ─── Mutations ────────────────────────────────────────────────────────────────

export const createAnnouncement = actionClient
  .schema(createAnnouncementSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireManagerOrAbove();
    const { title, body, entity_id, publish } = parsedInput;

    // Managers only create announcements for their own entity
    const effectiveEntityId =
      user.profile?.role === "admin"
        ? (entity_id ?? (await getEffectiveEntityId()))
        : (user.profile?.entityId ?? null);

    await db.insert(announcements).values({
      title,
      body,
      entityId: effectiveEntityId,
      publishedAt: publish ? new Date() : null,
      createdBy: user.id,
    });

    revalidatePath("/tablon");
    return { ok: true };
  });

export const updateAnnouncement = actionClient
  .schema(updateAnnouncementSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireManagerOrAbove();
    const { id, title, body, entity_id, publish } = parsedInput;

    // Verify ownership or admin
    const [existing] = await db
      .select({ createdBy: announcements.createdBy })
      .from(announcements)
      .where(eq(announcements.id, id))
      .limit(1);

    if (!existing) throw new Error("Comunicado no encontrado");
    if (existing.createdBy !== user.id && user.profile?.role !== "admin") {
      throw new Error("No tienes permiso para editar este comunicado");
    }

    const updateValues: Partial<typeof announcements.$inferInsert> = {};
    if (title !== undefined) updateValues.title = title;
    if (body !== undefined) updateValues.body = body;
    if (user.profile?.role === "admin" && entity_id !== undefined) {
      updateValues.entityId = entity_id ?? null;
    }
    if (publish !== undefined && publish) updateValues.publishedAt = new Date();

    await db
      .update(announcements)
      .set(updateValues)
      .where(eq(announcements.id, id));
    revalidatePath("/tablon");
    return { ok: true };
  });

export const publishAnnouncement = actionClient
  .schema(publishAnnouncementSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireManagerOrAbove();
    const { id } = parsedInput;

    const [existing] = await db
      .select({ createdBy: announcements.createdBy })
      .from(announcements)
      .where(and(eq(announcements.id, id)))
      .limit(1);

    if (!existing) throw new Error("Comunicado no encontrado");
    if (existing.createdBy !== user.id && user.profile?.role !== "admin") {
      throw new Error("No tienes permiso para publicar este comunicado");
    }

    await db
      .update(announcements)
      .set({ publishedAt: new Date() })
      .where(eq(announcements.id, id));

    revalidatePath("/tablon");
    return { ok: true };
  });

export const deleteAnnouncement = actionClient
  .schema(deleteAnnouncementSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireManagerOrAbove();
    const { id } = parsedInput;

    const [existing] = await db
      .select({ createdBy: announcements.createdBy })
      .from(announcements)
      .where(eq(announcements.id, id))
      .limit(1);

    if (!existing) throw new Error("Comunicado no encontrado");
    if (existing.createdBy !== user.id && user.profile?.role !== "admin") {
      throw new Error("No tienes permiso para eliminar este comunicado");
    }

    await db.delete(announcements).where(eq(announcements.id, id));
    revalidatePath("/tablon");
    return { ok: true };
  });

export const markAnnouncementRead = actionClient
  .schema(markAnnouncementReadSchema)
  .action(async ({ parsedInput }) => {
    const user = await getCurrentUser();
    if (!user) throw new Error("No autenticado");
    await markAsRead(parsedInput.announcement_id, user.id);
    revalidatePath("/tablon");
    return { ok: true };
  });

// ─── Query wrappers ───────────────────────────────────────────────────────────

export async function getMyFeedAnnouncements(): Promise<
  ActionResult<AnnouncementWithAuthor[]>
> {
  try {
    await requireAuth();
    const entityId = await getEffectiveEntityId();
    const data = await getPublishedAnnouncements(entityId);
    return { success: true, data };
  } catch (err) {
    console.error("[tablon] getMyFeedAnnouncements error:", err);
    return { success: false, error: "Error al cargar el tablón" };
  }
}

export async function getManageAnnouncements(): Promise<
  ActionResult<AnnouncementWithAuthor[]>
> {
  try {
    await requireManagerOrAbove();
    const entityId = await getEffectiveEntityId();
    const data = await getAnnouncementsForManagement(entityId);
    return { success: true, data };
  } catch (err) {
    console.error("[tablon] getManageAnnouncements error:", err);
    return { success: false, error: "Error al cargar los comunicados" };
  }
}
