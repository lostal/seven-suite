"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileImage, FileText, Loader2, Trash2, Upload } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useEntidades } from "./entidades-provider";
import type { ResourceType } from "@/lib/db/types";

const RESOURCE_LABELS: Record<ResourceType, string> = {
  parking: "Plano de parking",
  office: "Plano de oficinas",
};

function mapUrl(entityId: string, resourceType: ResourceType): string {
  return `/api/resource-maps/${entityId}/${resourceType}`;
}

export function ResourceMapsDialog() {
  const { open, setOpen, currentRow, setCurrentRow } = useEntidades();
  const router = useRouter();
  const [pending, setPending] = useState<ResourceType | null>(null);
  const parkingInput = useRef<HTMLInputElement>(null);
  const officeInput = useRef<HTMLInputElement>(null);

  if (!currentRow) return null;

  const close = () => {
    setOpen(null);
    setCurrentRow(null);
  };

  const uploadMap = async (resourceType: ResourceType, file: File | null) => {
    if (!file || !currentRow) return;
    setPending(resourceType);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(mapUrl(currentRow.id, resourceType), {
        method: "POST",
        body: formData,
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast.error(body.error ?? "No se pudo subir el plano");
        return;
      }
      toast.success(`${RESOURCE_LABELS[resourceType]} actualizado`);
      router.refresh();
    } catch {
      toast.error("No se pudo subir el plano");
    } finally {
      setPending(null);
    }
  };

  const deleteMap = async (resourceType: ResourceType) => {
    if (!currentRow) return;
    setPending(resourceType);
    try {
      const response = await fetch(mapUrl(currentRow.id, resourceType), {
        method: "DELETE",
      });
      if (!response.ok) {
        toast.error("No se pudo eliminar el plano");
        return;
      }
      toast.success(`${RESOURCE_LABELS[resourceType]} eliminado`);
      router.refresh();
    } catch {
      toast.error("No se pudo eliminar el plano");
    } finally {
      setPending(null);
    }
  };

  const renderResource = (
    resourceType: ResourceType,
    input: React.RefObject<HTMLInputElement | null>
  ) => {
    const available = currentRow.maps[resourceType];
    const isPending = pending === resourceType;

    return (
      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center gap-2">
          {resourceType === "parking" ? (
            <FileImage className="text-muted-foreground size-4" />
          ) : (
            <FileText className="text-muted-foreground size-4" />
          )}
          <Label className="font-medium">{RESOURCE_LABELS[resourceType]}</Label>
        </div>
        <p className="text-muted-foreground text-xs">
          PNG, JPEG, WebP o PDF. Tamaño máximo: 10 MB.
        </p>
        {available && (
          <a
            className="text-primary block truncate text-sm underline-offset-4 hover:underline"
            href={mapUrl(currentRow.id, resourceType)}
            target="_blank"
            rel="noreferrer"
          >
            Ver plano actual
          </a>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => input.current?.click()}
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {available ? "Reemplazar" : "Subir plano"}
          </Button>
          {available && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={isPending}
              onClick={() => deleteMap(resourceType)}
            >
              <Trash2 className="size-4" />
              Eliminar
            </Button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="sr-only"
          onChange={(event) => {
            void uploadMap(resourceType, event.target.files?.[0] ?? null);
            event.target.value = "";
          }}
        />
      </div>
    );
  };

  return (
    <Dialog open={open === "maps"} onOpenChange={(value) => !value && close()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Planos de {currentRow.name}</DialogTitle>
          <DialogDescription>
            Añade un plano opcional para ayudar a los usuarios antes de
            reservar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {renderResource("parking", parkingInput)}
          {renderResource("office", officeInput)}
        </div>
        <DialogFooter>
          <Button type="button" onClick={close}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
