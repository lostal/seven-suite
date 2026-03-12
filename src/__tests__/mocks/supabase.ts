/**
 * Helpers de Mock para Supabase
 *
 * Proporciona factories para crear clientes y query chains de Supabase
 * mockeados, listos para usar con vi.mock en los tests.
 */

import { vi } from "vitest";

export type QueryResponse<T = unknown> = {
  data: T;
  count?: number | null;
  error: { message: string; code?: string } | null;
};

/**
 * Crea un query chain mock que se puede encadenar con cualquier método
 * de Supabase y que resuelve con la respuesta dada al ser awaited.
 *
 * Soporta:
 * - Encadenamiento: .select().eq().neq().order()...
 * - await directo (thenable) para queries de array
 * - .single() y .maybeSingle() para queries de un único resultado
 */
export function createQueryChain<T = unknown>(response: QueryResponse<T>) {
  const chain: Record<string, unknown> & PromiseLike<QueryResponse<T>> = {
    select: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    or: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
    returns: vi.fn(),
    upsert: vi.fn(),
    single: vi.fn().mockResolvedValue(response),
    maybeSingle: vi.fn().mockResolvedValue(response),
    // Hace el chain thenable para soportar `await supabase.from(...).select(...)...`
    then<TResult1 = QueryResponse<T>, TResult2 = never>(
      onfulfilled?:
        | ((value: QueryResponse<T>) => TResult1 | PromiseLike<TResult1>)
        | null,
      onrejected?:
        | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
        | null
    ): Promise<TResult1 | TResult2> {
      return Promise.resolve(response).then(onfulfilled, onrejected);
    },
  };

  // Todos los métodos de encadenamiento devuelven el chain para permitir fluency
  const chainMethods = [
    "select",
    "eq",
    "neq",
    "gte",
    "lte",
    "or",
    "order",
    "limit",
    "update",
    "insert",
    "delete",
    "returns",
    "upsert",
  ] as const;

  for (const method of chainMethods) {
    (chain[method] as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  }

  return chain;
}

/**
 * Crea un cliente Supabase mock con respuestas configurables por tabla.
 *
 * Uso:
 * ```typescript
 * const mockClient = createSupabaseClientMock({
 *   spots: { data: [mockSpot], error: null },
 *   reservations: { data: [], error: null },
 * });
 * vi.mocked(createClient).mockResolvedValue(mockClient as never);
 * ```
 */
export function createSupabaseClientMock(
  tableResponses: Record<string, QueryResponse> = {}
) {
  return {
    from: vi.fn((table: string) =>
      createQueryChain(tableResponses[table] ?? { data: [], error: null })
    ),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      admin: {
        deleteUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
      },
    },
  };
}
