import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/helpers";
import { logAuditEvent } from "@/lib/audit";
import { db } from "@/lib/db";
import { entities, resourceMaps } from "@/lib/db/schema";
import { getEffectiveEntityId } from "@/lib/queries/active-entity";
import type { ResourceType } from "@/lib/db/types";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

interface RouteContext {
  params: Promise<{ entityId: string; resourceType: string }>;
}

function isResourceType(value: string): value is ResourceType {
  return value === "parking" || value === "office";
}

async function canAccessEntity(entityId: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user?.profile) return false;

  if (user.profile.role === "admin") {
    const [entity] = await db
      .select({ id: entities.id })
      .from(entities)
      .where(and(eq(entities.id, entityId), eq(entities.isActive, true)))
      .limit(1);
    return Boolean(entity);
  }

  if (user.profile.role === "manager") {
    if (user.profile.entityId !== entityId) return false;
    const [entity] = await db
      .select({ id: entities.id })
      .from(entities)
      .where(and(eq(entities.id, entityId), eq(entities.isActive, true)))
      .limit(1);
    return Boolean(entity);
  }

  return (await getEffectiveEntityId()) === entityId;
}

async function getRouteValues(context: RouteContext) {
  const { entityId, resourceType } = await context.params;
  if (!isResourceType(resourceType)) return null;
  if (!(await canAccessEntity(entityId))) return null;
  return { entityId, resourceType };
}

function hasTrustedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL
    ? new URL(process.env.NEXT_PUBLIC_APP_URL).origin
    : new URL(request.url).origin;
  return origin === configuredOrigin;
}

export async function GET(_request: Request, context: RouteContext) {
  const values = await getRouteValues(context);
  if (!values) return new NextResponse("No encontrado", { status: 404 });

  const [map] = await db
    .select({
      fileData: resourceMaps.fileData,
      fileName: resourceMaps.fileName,
      mimeType: resourceMaps.mimeType,
    })
    .from(resourceMaps)
    .where(
      and(
        eq(resourceMaps.entityId, values.entityId),
        eq(resourceMaps.resourceType, values.resourceType)
      )
    )
    .limit(1);

  if (!map) return new NextResponse("No encontrado", { status: 404 });

  return new Response(new Uint8Array(map.fileData), {
    headers: {
      "Content-Type": map.mimeType,
      "Content-Disposition": `inline; filename="${sanitizeFileName(map.fileName)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(request: Request, context: RouteContext) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  }
  const values = await getRouteValues(context);
  const user = await getCurrentUser();
  if (!values || !user?.profile) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }
  if (user.profile.role !== "admin" && user.profile.role !== "manager") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Selecciona un archivo" },
      { status: 400 }
    );
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Solo se admiten imágenes PNG, JPEG, WebP o archivos PDF" },
      { status: 400 }
    );
  }
  if (file.size === 0 || file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "El archivo debe ocupar entre 1 byte y 10 MB" },
      { status: 400 }
    );
  }

  const fileData = Buffer.from(await file.arrayBuffer());
  if (!hasExpectedSignature(file.type, fileData)) {
    return NextResponse.json(
      { error: "El contenido del archivo no coincide con su tipo" },
      { status: 400 }
    );
  }
  const [map] = await db
    .insert(resourceMaps)
    .values({
      entityId: values.entityId,
      resourceType: values.resourceType,
      fileData,
      fileName: file.name.slice(0, 255),
      mimeType: file.type,
      fileSizeBytes: file.size,
      uploadedBy: user.id,
    })
    .onConflictDoUpdate({
      target: [resourceMaps.entityId, resourceMaps.resourceType],
      set: {
        fileData,
        fileName: file.name.slice(0, 255),
        mimeType: file.type,
        fileSizeBytes: file.size,
        uploadedBy: user.id,
        updatedAt: new Date(),
      },
    })
    .returning({ id: resourceMaps.id });

  await logAuditEvent(
    "resource_map.uploaded",
    "resource_map",
    map?.id ?? null,
    {
      entityId: values.entityId,
      resourceType: values.resourceType,
      fileName: file.name.slice(0, 255),
      fileSizeBytes: file.size,
    }
  );

  return NextResponse.json({ id: map?.id }, { status: 201 });
}

export async function DELETE(_request: Request, context: RouteContext) {
  if (!hasTrustedOrigin(_request)) {
    return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  }
  const values = await getRouteValues(context);
  const user = await getCurrentUser();
  if (!values || !user?.profile) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }
  if (user.profile.role !== "admin" && user.profile.role !== "manager") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const deleted = await db
    .delete(resourceMaps)
    .where(
      and(
        eq(resourceMaps.entityId, values.entityId),
        eq(resourceMaps.resourceType, values.resourceType)
      )
    )
    .returning({ id: resourceMaps.id });

  if (deleted[0]) {
    await logAuditEvent("resource_map.deleted", "resource_map", deleted[0].id, {
      entityId: values.entityId,
      resourceType: values.resourceType,
    });
  }

  return new NextResponse(null, { status: 204 });
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[\\"\r\n]/g, "_");
}

function hasExpectedSignature(mimeType: string, data: Buffer): boolean {
  if (mimeType === "application/pdf") {
    return data.subarray(0, 5).toString("ascii") === "%PDF-";
  }
  if (mimeType === "image/png") {
    return data
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (mimeType === "image/jpeg") {
    return data.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
  }
  return (
    mimeType === "image/webp" &&
    data.subarray(0, 4).toString("ascii") === "RIFF" &&
    data.subarray(8, 12).toString("ascii") === "WEBP"
  );
}
