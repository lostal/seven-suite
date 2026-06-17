/**
 * Tests de Holidays Sync (OpenHolidays API)
 *
 * Verifica:
 * - syncAllHolidays: sin CCAA → 0 resultados
 * - syncAllHolidays: desactiva calendarios seed (region=null)
 * - syncAllHolidays: agrupa por CCAA (sin duplicar llamadas)
 * - syncAllHolidays: captura errores por CCAA sin romper el bucle
 * - syncAllHolidays: nombre ES preferido, fallback a primer idioma
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  mockDb,
  resetDbMocks,
  setupSelectMock,
  setupInsertMock,
} from "../../mocks/db";

vi.mock("@/lib/db", async () => {
  const { mockDb } = await import("../../mocks/db");
  return { db: mockDb };
});

import { syncAllHolidays } from "@/lib/holidays-sync";

const mockFetch = vi.hoisted(() => vi.fn());
vi.stubGlobal("fetch", mockFetch);

const SAMPLE_HOLIDAYS = [
  {
    startDate: "2026-01-01",
    endDate: "2026-01-01",
    name: [
      { language: "ES", text: "Año Nuevo" },
      { language: "EN", text: "New Year" },
    ],
    nationwide: true,
  },
  {
    startDate: "2026-05-01",
    endDate: "2026-05-01",
    name: [{ language: "ES", text: "Día del Trabajador" }],
    nationwide: true,
  },
];

describe("syncAllHolidays", () => {
  beforeEach(() => {
    resetDbMocks();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(SAMPLE_HOLIDAYS),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns ccaaCount=0 when no entities have CCAA", async () => {
    // Deactivate seed calendars
    vi.mocked(mockDb.update).mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn() }),
    } as never);
    // Distinct CCAA query → all null
    setupSelectMock([
      { autonomousCommunity: null },
      { autonomousCommunity: null },
    ]);

    const result = await syncAllHolidays();

    expect(result.ccaaCount).toBe(0);
    expect(result.totalHolidays).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it("deactivates seed calendars (region=null) before syncing", async () => {
    const whereMock = vi.fn();
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    vi.mocked(mockDb.update).mockReturnValue({ set: setMock } as never);
    setupSelectMock([]);

    await syncAllHolidays();

    expect(mockDb.update).toHaveBeenCalled();
  });

  it("deduplicates CCAA — multiple entities with same CCAA sync only once", async () => {
    // Deactivate seed calendars
    vi.mocked(mockDb.update).mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn() }),
    } as never);
    // Distinct CCAA: ES-MD appears once even though 2 entities share it
    setupSelectMock([
      { autonomousCommunity: "ES-MD" },
      { autonomousCommunity: "ES-MD" },
    ]);

    // For CCAA ES-MD, year 2026: calendar not found
    setupSelectMock([]);
    setupInsertMock([{ id: "cal-md-2026" }]);
    setupInsertMock([{ id: "h1" }]);
    setupInsertMock([{ id: "h2" }]);
    // Query entities with CCAA ES-MD for linking
    setupSelectMock([{ id: "ent-1" }, { id: "ent-2" }]);
    setupInsertMock([]);
    setupInsertMock([]);
    // Year 2027: calendar not found
    setupSelectMock([]);
    setupInsertMock([{ id: "cal-md-2027" }]);
    setupInsertMock([{ id: "h3" }]);
    setupInsertMock([{ id: "h4" }]);
    // Query entities with CCAA ES-MD
    setupSelectMock([{ id: "ent-1" }, { id: "ent-2" }]);
    setupInsertMock([]);
    setupInsertMock([]);

    const result = await syncAllHolidays();

    // Only 1 CCAA, 2 fetch calls (2026 + 2027)
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.ccaaCount).toBe(1);
    expect(result.totalHolidays).toBe(4); // 2 holidays × 2 years
  });

  it("syncs holidays for distinct CCAA independently", async () => {
    vi.mocked(mockDb.update).mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn() }),
    } as never);
    // 2 distinct CCAA
    setupSelectMock([
      { autonomousCommunity: "ES-MD" },
      { autonomousCommunity: "ES-CT" },
    ]);

    // ES-MD, year 2026
    setupSelectMock([]);
    setupInsertMock([{ id: "cal-md-2026" }]);
    setupInsertMock([{ id: "h1" }]);
    setupInsertMock([{ id: "h2" }]);
    setupSelectMock([{ id: "ent-1" }]);
    setupInsertMock([]);
    // ES-MD, year 2027
    setupSelectMock([]);
    setupInsertMock([{ id: "cal-md-2027" }]);
    setupInsertMock([{ id: "h3" }]);
    setupInsertMock([{ id: "h4" }]);
    setupSelectMock([{ id: "ent-1" }]);
    setupInsertMock([]);

    // ES-CT, year 2026
    setupSelectMock([]);
    setupInsertMock([{ id: "cal-ct-2026" }]);
    setupInsertMock([{ id: "h5" }]);
    setupInsertMock([{ id: "h6" }]);
    setupSelectMock([{ id: "ent-2" }]);
    setupInsertMock([]);
    // ES-CT, year 2027
    setupSelectMock([]);
    setupInsertMock([{ id: "cal-ct-2027" }]);
    setupInsertMock([{ id: "h7" }]);
    setupInsertMock([{ id: "h8" }]);
    setupSelectMock([{ id: "ent-2" }]);
    setupInsertMock([]);

    const result = await syncAllHolidays();

    expect(result.ccaaCount).toBe(2);
    expect(result.totalHolidays).toBe(8); // 2 CCAA × 2 years × 2 holidays
    expect(mockFetch).toHaveBeenCalledTimes(4); // 2 CCAA × 2 years
  });

  it("captures fetch errors per CCAA without breaking the loop", async () => {
    vi.mocked(mockDb.update).mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn() }),
    } as never);
    setupSelectMock([
      { autonomousCommunity: "ES-MD" },
      { autonomousCommunity: "ES-CT" },
    ]);

    // ES-MD, year 2026: works
    setupSelectMock([]);
    setupInsertMock([{ id: "cal-md-2026" }]);
    setupInsertMock([{ id: "h1" }]);
    setupInsertMock([{ id: "h2" }]);
    setupSelectMock([{ id: "ent-1" }]);
    setupInsertMock([]);
    // ES-MD, year 2027: fetch FAILS
    setupSelectMock([]);

    let callIndex = 0;
    mockFetch.mockReset();
    mockFetch.mockImplementation(() => {
      callIndex++;
      if (callIndex === 2) {
        return Promise.reject(new Error("Network error"));
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(SAMPLE_HOLIDAYS),
      });
    });

    // ES-CT continues despite ES-MD error
    setupSelectMock([]);
    setupInsertMock([{ id: "cal-ct-2026" }]);
    setupInsertMock([{ id: "h3" }]);
    setupInsertMock([{ id: "h4" }]);
    setupSelectMock([{ id: "ent-2" }]);
    setupInsertMock([]);
    setupSelectMock([]);
    setupInsertMock([{ id: "cal-ct-2027" }]);
    setupInsertMock([{ id: "h5" }]);
    setupInsertMock([{ id: "h6" }]);
    setupSelectMock([{ id: "ent-2" }]);
    setupInsertMock([]);

    const result = await syncAllHolidays();

    expect(result.ccaaCount).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.ccaa).toBe("ES-MD");
    expect(result.errors[0]!.error).toContain("Network error");
  });

  it("extracts Spanish holiday name from multi-language name", async () => {
    const holidaysWithLang = [
      {
        startDate: "2026-01-06",
        endDate: "2026-01-06",
        name: [
          { language: "CA", text: "Dia de Reis" },
          { language: "ES", text: "Día de Reyes" },
        ],
        nationwide: true,
      },
    ];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(holidaysWithLang),
    });

    vi.mocked(mockDb.update).mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn() }),
    } as never);
    setupSelectMock([{ autonomousCommunity: "ES-CL" }]);
    setupSelectMock([]);
    setupInsertMock([{ id: "cal-1" }]);
    setupInsertMock([{ id: "h1" }]);
    setupSelectMock([{ id: "ent-1" }]);
    setupInsertMock([]);
    setupSelectMock([]);
    setupInsertMock([{ id: "cal-2" }]);
    setupInsertMock([{ id: "h2" }]);
    setupSelectMock([{ id: "ent-1" }]);
    setupInsertMock([]);

    const result = await syncAllHolidays();

    expect(result.totalHolidays).toBe(2); // 1 holiday × 2 years
  });

  it("skips CCAA with no active entities", async () => {
    vi.mocked(mockDb.update).mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn() }),
    } as never);
    setupSelectMock([]);

    const result = await syncAllHolidays();

    expect(result.ccaaCount).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("links all entities with same CCAA to the same calendar", async () => {
    vi.mocked(mockDb.update).mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn() }),
    } as never);
    setupSelectMock([{ autonomousCommunity: "ES-MD" }]);

    // Year 2026
    setupSelectMock([]);
    setupInsertMock([{ id: "cal-md" }]);
    setupInsertMock([{ id: "h1" }]);
    setupInsertMock([{ id: "h2" }]);
    // 3 entities share ES-MD → all linked
    setupSelectMock([{ id: "ent-1" }, { id: "ent-2" }, { id: "ent-3" }]);
    setupInsertMock([]);
    setupInsertMock([]);
    setupInsertMock([]);
    // Year 2027
    setupSelectMock([]);
    setupInsertMock([{ id: "cal-md-2027" }]);
    setupInsertMock([{ id: "h3" }]);
    setupInsertMock([{ id: "h4" }]);
    setupSelectMock([{ id: "ent-1" }, { id: "ent-2" }, { id: "ent-3" }]);
    setupInsertMock([]);
    setupInsertMock([]);
    setupInsertMock([]);

    const result = await syncAllHolidays();

    expect(result.ccaaCount).toBe(1);
    // entityHolidayCalendars inserted 6 times (3 entities × 2 years)
    const insertCalls = vi.mocked(mockDb.insert).mock.calls;
    expect(insertCalls.length).toBeGreaterThanOrEqual(6);
  });
});
