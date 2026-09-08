"use client";

import { useState } from "react";
import Image from "next/image";
import { ExternalLink, Map } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ResourceMapDialogProps {
  mapUrl: string;
  mimeType: string;
  resourceLabel: string;
}

export function ResourceMapDialog({
  mapUrl,
  mimeType,
  resourceLabel,
}: ResourceMapDialogProps) {
  const [open, setOpen] = useState(false);
  const isPdf = mimeType === "application/pdf";

  if (isPdf) {
    return (
      <Button asChild variant="outline" size="sm" className="w-fit">
        <a href={mapUrl} target="_blank" rel="noreferrer">
          <Map className="size-4" />
          Ver plano
          <ExternalLink className="size-3.5" />
        </a>
      </Button>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={() => setOpen(true)}
      >
        <Map className="size-4" />
        Ver plano
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] max-w-4xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>Plano de {resourceLabel}</DialogTitle>
            <DialogDescription>
              Consulta la distribución antes de elegir un espacio.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted relative flex max-h-[70dvh] min-h-80 items-center justify-center overflow-auto rounded-lg p-2">
            <Image
              src={mapUrl}
              alt={`Plano de ${resourceLabel}`}
              fill
              unoptimized
              sizes="(max-width: 768px) 100vw, 896px"
              className="object-contain"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
