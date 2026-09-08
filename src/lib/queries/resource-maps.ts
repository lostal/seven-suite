import { db } from "@/lib/db";
import { resourceMaps } from "@/lib/db/schema";
import type { ResourceType } from "@/lib/db/types";
import { and, eq } from "drizzle-orm";

export type ResourceMapSummary = Pick<
  typeof resourceMaps.$inferSelect,
  "id" | "fileName" | "mimeType" | "fileSizeBytes" | "updatedAt"
>;

export async function getResourceMap(
  entityId: string | null,
  resourceType: ResourceType
): Promise<ResourceMapSummary | null> {
  if (!entityId) return null;

  const [map] = await db
    .select({
      id: resourceMaps.id,
      fileName: resourceMaps.fileName,
      mimeType: resourceMaps.mimeType,
      fileSizeBytes: resourceMaps.fileSizeBytes,
      updatedAt: resourceMaps.updatedAt,
    })
    .from(resourceMaps)
    .where(
      and(
        eq(resourceMaps.entityId, entityId),
        eq(resourceMaps.resourceType, resourceType)
      )
    )
    .limit(1);

  return map ?? null;
}

export async function getResourceMapSummaries(
  entityId: string
): Promise<Record<ResourceType, ResourceMapSummary | null>> {
  const rows = await db
    .select({
      id: resourceMaps.id,
      resourceType: resourceMaps.resourceType,
      fileName: resourceMaps.fileName,
      mimeType: resourceMaps.mimeType,
      fileSizeBytes: resourceMaps.fileSizeBytes,
      updatedAt: resourceMaps.updatedAt,
    })
    .from(resourceMaps)
    .where(eq(resourceMaps.entityId, entityId));

  return {
    parking: rows.find((row) => row.resourceType === "parking") ?? null,
    office: rows.find((row) => row.resourceType === "office") ?? null,
  };
}
