import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Date helpers ─────────────────────────────────────────────

/**
 * Convierte un Date a "yyyy-MM-dd" usando los componentes de hora LOCAL del
 * entorno donde se ejecuta (servidor en UTC). No usar en código
 * cliente si el usuario puede estar en una zona distinta a UTC; en ese caso
 * usar `toClientDateStr`.
 */
export function toServerDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Convierte un Date a "yyyy-MM-dd" en la zona horaria del cliente.
 * Usa Intl.DateTimeFormat para respetar el timezone del usuario.
 *
 * @param d - La fecha a convertir
 * @param timeZone - Zona horaria IANA, p.ej. "Europe/Madrid" (por defecto la del sistema)
 */
export function toClientDateStr(d: Date, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  }).formatToParts(d);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * Devuelve true si la fecha ISO dada es anterior a hoy (hora del servidor).
 */
export function isPast(dateStr: string): boolean {
  return dateStr < toServerDateStr(new Date());
}

/**
 * Devuelve el día de la semana para una fecha ISO "yyyy-MM-dd".
 * 0 = Domingo, 1 = Lunes, ..., 6 = Sábado.
 * Usa componentes locales para evitar desfases UTC.
 */
export function getDayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y!, m! - 1, d!).getDay();
}

/**
 * Generates page numbers for pagination with ellipsis.
 *
 * Examples:
 * - ≤5 páginas: [1, 2, 3, 4, 5]
 * - Inicio: [1, 2, 3, 4, '...', 10]
 * - Medio: [1, '...', 4, 5, 6, '...', 10]
 * - Final: [1, '...', 7, 8, 9, 10]
 */
export function getPageNumbers(currentPage: number, totalPages: number) {
  const maxVisiblePages = 5;
  const rangeWithDots: (number | string)[] = [];

  if (totalPages <= maxVisiblePages) {
    for (let i = 1; i <= totalPages; i++) rangeWithDots.push(i);
  } else {
    rangeWithDots.push(1);
    if (currentPage <= 3) {
      for (let i = 2; i <= 4; i++) rangeWithDots.push(i);
      rangeWithDots.push("...", totalPages);
    } else if (currentPage >= totalPages - 2) {
      rangeWithDots.push("...");
      for (let i = totalPages - 3; i <= totalPages; i++) rangeWithDots.push(i);
    } else {
      rangeWithDots.push("...");
      for (let i = currentPage - 1; i <= currentPage + 1; i++)
        rangeWithDots.push(i);
      rangeWithDots.push("...", totalPages);
    }
  }

  return rangeWithDots;
}
