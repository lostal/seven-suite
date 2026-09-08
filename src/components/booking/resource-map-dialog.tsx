"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  AlertCircle,
  Download,
  ExternalLink,
  Loader2,
  Map,
} from "lucide-react";

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
  const [isExpanded, setIsExpanded] = useState(false);
  const [mediaRatio, setMediaRatio] = useState(16 / 9);
  const isPdf = mimeType === "application/pdf";

  const toggleExpanded = () => {
    if (window.matchMedia("(pointer: coarse)").matches) return;
    setIsExpanded((value) => !value);
  };

  if (isPdf) {
    return (
      <PdfResourceMapDialog mapUrl={mapUrl} resourceLabel={resourceLabel} />
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={() => {
          setIsExpanded(false);
          setOpen(true);
        }}
      >
        <Map className="size-4" />
        Ver plano
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={
            isExpanded
              ? "max-h-[90dvh] !w-[95vw] !max-w-[1200px] overflow-y-auto rounded-2xl p-4 sm:!max-w-[1200px]"
              : "max-h-[90dvh] !w-[min(90vw,52rem)] !max-w-[52rem] overflow-y-auto rounded-2xl p-4 sm:!max-w-[52rem]"
          }
        >
          <DialogHeader>
            <DialogTitle>Plano de {resourceLabel}</DialogTitle>
            <DialogDescription>
              Consulta la distribución antes de elegir un espacio.
            </DialogDescription>
          </DialogHeader>
          <button
            type="button"
            aria-label={isExpanded ? "Reducir plano" : "Ampliar plano"}
            onClick={toggleExpanded}
            className={`bg-muted focus-visible:ring-ring relative flex max-h-[78dvh] min-h-40 w-full items-center justify-center overflow-auto rounded-lg p-2 focus-visible:ring-2 focus-visible:outline-none ${isExpanded ? "cursor-zoom-out" : "cursor-zoom-in"}`}
            style={{ aspectRatio: mediaRatio }}
          >
            <Image
              src={mapUrl}
              alt={`Plano de ${resourceLabel}`}
              fill
              unoptimized
              sizes="(max-width: 768px) 100vw, 896px"
              className="object-contain transition-transform duration-200"
              style={{ transform: isExpanded ? "scale(1.25)" : undefined }}
              onLoad={(event) => {
                const image = event.currentTarget;
                if (image.naturalWidth && image.naturalHeight) {
                  setMediaRatio(image.naturalWidth / image.naturalHeight);
                }
              }}
            />
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PdfResourceMapDialog({
  mapUrl,
  resourceLabel,
}: {
  mapUrl: string;
  resourceLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [mediaRatio, setMediaRatio] = useState(16 / 9);
  const [viewerWidth, setViewerWidth] = useState(0);
  const viewerRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const [viewerElement, setViewerElement] = useState<HTMLDivElement | null>(
    null
  );
  const documentRef = useRef<{
    numPages: number;
    getPage: (pageNumber: number) => Promise<unknown>;
    cleanup?: () => void;
  } | null>(null);

  const openViewer = () => {
    setError(null);
    setPageCount(0);
    setIsExpanded(false);
    setMediaRatio(16 / 9);
    setIsLoading(true);
    setOpen(true);
  };

  const setViewerRef = useCallback((element: HTMLDivElement | null) => {
    viewerRef.current = element;
    setViewerElement(element);
  }, []);

  const toggleExpanded = () => {
    if (window.matchMedia("(pointer: coarse)").matches) return;
    setIsExpanded((value) => !value);
  };

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    documentRef.current = null;

    const loadPdf = async () => {
      try {
        const response = await fetch(mapUrl, { credentials: "same-origin" });
        if (!response.ok) throw new Error("No se pudo cargar el plano");

        const data = await response.arrayBuffer();
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/legacy/build/pdf.worker.mjs",
          import.meta.url
        ).toString();

        const document = await pdfjs.getDocument({ data }).promise;
        if (cancelled) {
          return;
        }

        documentRef.current = document;
        const firstPage = (await document.getPage(1)) as {
          getViewport: (options: { scale: number }) => {
            width: number;
            height: number;
          };
        };
        const firstViewport = firstPage.getViewport({ scale: 1 });
        setMediaRatio(firstViewport.width / firstViewport.height);
        setPageCount(document.numPages);
        setIsLoading(false);
      } catch {
        if (!cancelled) {
          setError("No se pudo mostrar el plano PDF.");
          setIsLoading(false);
        }
      }
    };

    void loadPdf();

    return () => {
      cancelled = true;
      const document = documentRef.current;
      documentRef.current = null;
      document?.cleanup?.();
    };
  }, [mapUrl, open]);

  useEffect(() => {
    if (!open || !viewerElement) return;

    const viewer = viewerElement;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect.width ?? 0;
      setViewerWidth(Math.round(width));
    });

    observer.observe(viewer);
    return () => observer.disconnect();
  }, [open, isExpanded, viewerElement]);

  useEffect(() => {
    if (
      !pageCount ||
      !viewerRef.current ||
      !documentRef.current ||
      !viewerWidth
    ) {
      return;
    }

    let cancelled = false;
    const renderPages = async () => {
      const viewer = viewerRef.current;
      const document = documentRef.current;
      const pages = pagesRef.current;
      if (!viewer || !pages || !document) return;

      pages.replaceChildren();
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve())
      );
      const availableWidth = Math.max(viewerWidth - 16, 280);

      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
        if (cancelled) return;
        const page = (await document.getPage(pageNumber)) as {
          getViewport: (options: { scale: number }) => {
            width: number;
            height: number;
          };
          render: (options: {
            canvasContext: CanvasRenderingContext2D;
            viewport: { width: number; height: number };
            transform?: [number, number, number, number, number, number];
          }) => { promise: Promise<void> };
        };
        const baseViewport = page.getViewport({ scale: 1 });
        const scale =
          (availableWidth / baseViewport.width) * (isExpanded ? 1.35 : 1);
        const viewport = page.getViewport({ scale });
        const outputScale = Math.min(window.devicePixelRatio || 1, 3);
        const canvas = window.document.createElement("canvas");
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        canvas.className = "h-auto rounded-sm bg-white shadow-sm";
        canvas.style.cursor = "zoom-in";
        canvas.addEventListener("click", toggleExpanded);
        pages.appendChild(canvas);

        const canvasContext = canvas.getContext("2d");
        if (!canvasContext) throw new Error("Canvas no disponible");

        await page.render({
          canvasContext,
          transform:
            outputScale === 1
              ? undefined
              : [outputScale, 0, 0, outputScale, 0, 0],
          viewport,
        }).promise;
      }
    };

    void renderPages().catch(() => {
      if (!cancelled) setError("No se pudo renderizar el plano PDF.");
    });

    return () => {
      cancelled = true;
    };
  }, [pageCount, viewerWidth, isExpanded]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={openViewer}
      >
        <Map className="size-4" />
        Ver plano
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={
            isExpanded
              ? "max-h-[90dvh] !w-[95vw] !max-w-[1200px] overflow-y-auto rounded-2xl p-4 sm:!max-w-[1200px]"
              : "max-h-[90dvh] !w-[min(90vw,52rem)] !max-w-[52rem] overflow-y-auto rounded-2xl p-4 sm:!max-w-[52rem]"
          }
        >
          <DialogHeader>
            <DialogTitle>Plano de {resourceLabel}</DialogTitle>
            <DialogDescription>
              Consulta la distribución antes de elegir un espacio.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-muted-foreground text-sm">
              {pageCount > 0
                ? `${pageCount} página${pageCount === 1 ? "" : "s"}`
                : ""}
            </span>
            <div className="flex gap-2">
              <Button asChild variant="ghost" size="sm">
                <a href={mapUrl} download>
                  <Download className="size-4" />
                  Descargar
                </a>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <a href={mapUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" />
                  Visor del navegador
                </a>
              </Button>
            </div>
          </div>
          <div
            ref={setViewerRef}
            className={`bg-muted max-h-[78dvh] min-h-40 w-full overflow-auto rounded-lg p-2 ${isExpanded ? "cursor-zoom-out" : "cursor-zoom-in"}`}
            style={{ aspectRatio: mediaRatio }}
          >
            <div ref={pagesRef} className="flex flex-col items-center gap-3" />
            {isLoading && (
              <div className="text-muted-foreground flex min-h-72 items-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" />
                Cargando plano...
              </div>
            )}
            {error && (
              <div className="text-destructive flex min-h-72 items-center gap-2 text-sm">
                <AlertCircle className="size-4" />
                {error}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
