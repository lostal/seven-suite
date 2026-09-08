/**
 * Mock de Drizzle ORM para tests
 *
 * Proporciona un objeto `db` mock con métodos encadenables que imitan
 * la API de Drizzle ORM. Los métodos de construcción de queries devuelven
 * el propio mock para permitir el encadenamiento fluido, y los métodos
 * terminales (`then`) resuelven con los datos configurados.
 *
 * Uso:
 * ```ts
 * import { mockDb, setupSelectMock, setupInsertMock } from "../../mocks/db";
 *
 * vi.mock("@/lib/db", () => ({ db: mockDb }));
 *
 * // En beforeEach:
 * resetDbMocks();
 *
 * // Para configurar una respuesta de select:
 * setupSelectMock([row1, row2]);
 *
 * // Para configurar una respuesta de insert con returning:
 * setupInsertMock([{ id: "new-id" }]);
 * ```
 */

import { vi } from "vitest";

// ─── Tipo interno del mock ────────────────────────────────────────────────────

export type MockDbResult = Record<string, unknown>[] | null;

// ─── Estado interno ───────────────────────────────────────────────────────────

// Cola de resultados para select, uno por llamada a select()
let _selectResults: MockDbResult[] = [];
let _insertResults: MockDbResult[] = [];
let _updateResults: MockDbResult[] = [];
let _deleteResults: MockDbResult[] = [];

// ─── Helpers de configuración ─────────────────────────────────────────────────

/** Reinicia todos los mocks de DB (llamar en beforeEach) */
export function resetDbMocks() {
  _selectResults = [];
  _insertResults = [];
  _updateResults = [];
  _deleteResults = [];
  vi.clearAllMocks();
}

/** Encola un resultado para la próxima llamada a db.select()...then() */
export function setupSelectMock(data: MockDbResult) {
  _selectResults.push(data);
}

/** Encola un resultado para la próxima llamada a db.insert()...returning() */
export function setupInsertMock(data: MockDbResult) {
  _insertResults.push(data);
}

/** Encola un resultado para la próxima llamada a db.update()...returning() */
export function setupUpdateMock(data: MockDbResult) {
  _updateResults.push(data);
}

/** Encola un resultado para la próxima llamada a db.delete()...returning() */
export function setupDeleteMock(data: MockDbResult) {
  _deleteResults.push(data);
}

// ─── Fábrica de query builder mock ───────────────────────────────────────────

/**
 * Crea un query builder encadenable que resuelve con `data` cuando se awaita.
 * Todos los métodos de construcción devuelven el propio builder.
 */
function createQueryBuilder(
  data: MockDbResult
): Record<string, unknown> & PromiseLike<MockDbResult> {
  const builder: Record<string, unknown> & PromiseLike<MockDbResult> = {
    // Métodos de construcción de queries (devuelven this para encadenamiento)
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    having: vi.fn().mockReturnThis(),
    for: vi.fn().mockReturnThis(),
    // Para select con columnas específicas
    columns: vi.fn().mockReturnThis(),
    // Para insert
    values: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    // Para update
    set: vi.fn().mockReturnThis(),
    // Para returning
    returning: vi.fn().mockResolvedValue(data ?? []),
    // Para IN clause
    in: vi.fn().mockReturnThis(),
    // Hace el builder thenable (soporta await)
    then<TResult1 = MockDbResult, TResult2 = never>(
      onfulfilled?:
        ((value: MockDbResult) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?:
        ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ): Promise<TResult1 | TResult2> {
      return Promise.resolve(data).then(onfulfilled, onrejected);
    },
  };

  // Los métodos de construcción devuelven el propio builder
  (builder.from as ReturnType<typeof vi.fn>).mockReturnValue(builder);
  (builder.where as ReturnType<typeof vi.fn>).mockReturnValue(builder);
  (builder.innerJoin as ReturnType<typeof vi.fn>).mockReturnValue(builder);
  (builder.leftJoin as ReturnType<typeof vi.fn>).mockReturnValue(builder);
  (builder.orderBy as ReturnType<typeof vi.fn>).mockReturnValue(builder);
  (builder.limit as ReturnType<typeof vi.fn>).mockReturnValue(builder);
  (builder.offset as ReturnType<typeof vi.fn>).mockReturnValue(builder);
  (builder.groupBy as ReturnType<typeof vi.fn>).mockReturnValue(builder);
  (builder.having as ReturnType<typeof vi.fn>).mockReturnValue(builder);
  (builder.for as ReturnType<typeof vi.fn>).mockReturnValue(builder);
  (builder.columns as ReturnType<typeof vi.fn>).mockReturnValue(builder);
  (builder.values as ReturnType<typeof vi.fn>).mockReturnValue(builder);
  (builder.onConflictDoNothing as ReturnType<typeof vi.fn>).mockReturnValue(
    builder
  );
  (builder.onConflictDoUpdate as ReturnType<typeof vi.fn>).mockReturnValue(
    builder
  );
  (builder.set as ReturnType<typeof vi.fn>).mockReturnValue(builder);
  (builder.in as ReturnType<typeof vi.fn>).mockReturnValue(builder);

  return builder;
}

// ─── Mock del objeto db ───────────────────────────────────────────────────────

export const mockDb = {
  select: vi.fn((_columns?: unknown) => {
    const data = _selectResults.shift() ?? [];
    return createQueryBuilder(data);
  }),
  insert: vi.fn((_table?: unknown) => {
    const data = _insertResults.shift() ?? [];
    return createQueryBuilder(data);
  }),
  update: vi.fn((_table?: unknown) => {
    const data = _updateResults.shift() ?? [];
    return createQueryBuilder(data);
  }),
  delete: vi.fn((_table?: unknown) => {
    const data = _deleteResults.shift() ?? [];
    return createQueryBuilder(data);
  }),
  // Para transacciones (si se usa en el futuro)
  transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
    return fn(mockDb);
  }),
};
