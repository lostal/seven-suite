import { db } from "@/lib/db";
import { announcements, announcementReads, profiles } from "@/lib/db/schema";
import { eq, and, or, isNull, lte, gte, notExists, desc } from "drizzle-orm";
import { sanitizeAnnouncementHtml } from "@/lib/content/sanitize-html";

export type AnnouncementWithAuthor = {
  id: string;
  title: string;
  body: string;
  entityId: string | null;
  publishedAt: Date | null;
  expiresAt: Date | null;
  authorName: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  isRead?: boolean;
};

const ANNOUNCEMENT_SELECT = {
  id: announcements.id,
  title: announcements.title,
  body: announcements.body,
  entityId: announcements.entityId,
  publishedAt: announcements.publishedAt,
  expiresAt: announcements.expiresAt,
  createdBy: announcements.createdBy,
  createdAt: announcements.createdAt,
  updatedAt: announcements.updatedAt,
  authorName: profiles.fullName,
} as const;

function toRow(r: {
  id: string;
  title: string;
  body: string;
  entityId: string | null;
  publishedAt: Date | null;
  expiresAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  authorName: string | null;
}): AnnouncementWithAuthor {
  return {
    ...r,
    body: sanitizeAnnouncementHtml(r.body),
    authorName: r.authorName ?? "",
  };
}

/**
 * Feed: comunicados publicados y no expirados visibles para una sede.
 * Incluye globales (entityId = null) + los de la sede concreta.
 */
export async function getPublishedAnnouncements(
  entityId: string | null
): Promise<AnnouncementWithAuthor[]> {
  const now = new Date();

  const visibilityCondition =
    entityId !== null
      ? or(isNull(announcements.entityId), eq(announcements.entityId, entityId))
      : isNull(announcements.entityId);

  const rows = await db
    .select(ANNOUNCEMENT_SELECT)
    .from(announcements)
    .innerJoin(profiles, eq(announcements.createdBy, profiles.id))
    .where(
      and(
        visibilityCondition,
        // publicado
        lte(announcements.publishedAt, now),
        // no expirado: sin fecha de expiración, o fecha futura
        or(isNull(announcements.expiresAt), gte(announcements.expiresAt, now))
      )
    )
    .orderBy(desc(announcements.publishedAt));

  return rows.map(toRow);
}

/**
 * Gestión: todos los comunicados (incluidos borradores) de una sede.
 * Admin con entityId = null ve también los globales.
 */
export async function getAnnouncementsForManagement(
  entityId: string | null
): Promise<AnnouncementWithAuthor[]> {
  const visibilityCondition =
    entityId !== null
      ? or(isNull(announcements.entityId), eq(announcements.entityId, entityId))
      : isNull(announcements.entityId);

  const rows = await db
    .select(ANNOUNCEMENT_SELECT)
    .from(announcements)
    .innerJoin(profiles, eq(announcements.createdBy, profiles.id))
    .where(visibilityCondition)
    .orderBy(desc(announcements.createdAt));

  return rows.map(toRow);
}

/**
 * Cuenta los comunicados publicados no leídos por el usuario en su sede.
 * Usado para el badge en la sidebar.
 */
export async function countUnreadAnnouncements(
  userId: string,
  entityId: string | null
): Promise<number> {
  const now = new Date();

  const visibilityCondition =
    entityId !== null
      ? or(isNull(announcements.entityId), eq(announcements.entityId, entityId))
      : isNull(announcements.entityId);

  const rows = await db
    .select({ id: announcements.id })
    .from(announcements)
    .where(
      and(
        visibilityCondition,
        lte(announcements.publishedAt, now),
        or(isNull(announcements.expiresAt), gte(announcements.expiresAt, now)),
        notExists(
          db
            .select({ announcementId: announcementReads.announcementId })
            .from(announcementReads)
            .where(
              and(
                eq(announcementReads.announcementId, announcements.id),
                eq(announcementReads.userId, userId)
              )
            )
        )
      )
    );

  return rows.length;
}

/**
 * Devuelve el Set de IDs de comunicados no leídos por el usuario en su sede.
 * Usado en la página del feed para marcar el estado isRead de cada card.
 */
export async function getUnreadAnnouncementIds(
  userId: string,
  entityId: string | null
): Promise<Set<string>> {
  const now = new Date();

  const visibilityCondition =
    entityId !== null
      ? or(isNull(announcements.entityId), eq(announcements.entityId, entityId))
      : isNull(announcements.entityId);

  const rows = await db
    .select({ id: announcements.id })
    .from(announcements)
    .where(
      and(
        visibilityCondition,
        lte(announcements.publishedAt, now),
        or(isNull(announcements.expiresAt), gte(announcements.expiresAt, now)),
        notExists(
          db
            .select({ announcementId: announcementReads.announcementId })
            .from(announcementReads)
            .where(
              and(
                eq(announcementReads.announcementId, announcements.id),
                eq(announcementReads.userId, userId)
              )
            )
        )
      )
    );

  return new Set(rows.map((r) => r.id));
}

/**
 * Marca un comunicado como leído por el usuario (upsert).
 */
export async function markAsRead(
  announcementId: string,
  userId: string
): Promise<void> {
  await db
    .insert(announcementReads)
    .values({ announcementId, userId })
    .onConflictDoNothing();
}
