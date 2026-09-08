/**
 * Utilidades para Server Actions
 *
 * Wrapper tipado para todas las Server Actions que proporciona:
 * - Tipo de retorno consistente (ActionResult<T>)
 * - Validación automática con Zod
 * - Gestión centralizada de errores
 *
 * Uso:
 *   "use server";
 *   import { actionClient } from "@/lib/actions";
 *   import { createReservationSchema } from "@/lib/validations";
 *
 *   export const createReservation = actionClient
 *     .schema(createReservationSchema)
 *     .action(async ({ parsedInput }) => {
 *       // ... tu lógica
 *       return { id: "123" };
 *     });
 */

import { type ZodType } from "zod/v4";

// ─── Tipos de resultado ───────────────────────────────────────

export type ActionSuccess<T> = {
  success: true;
  data: T;
};

export type ActionError = {
  success: false;
  error: string;
  fieldErrors?: Record<string, string[]>;
};

export type ActionResult<T> = ActionSuccess<T> | ActionError;

const SAFE_ERROR_PREFIXES = [
  "No autenticado",
  "Sin permisos",
  "No tienes",
  "No puedes",
  "Ya ",
  "Esta ",
  "Este ",
  "La ",
  "El ",
  "Las ",
  "Solo puedes",
  "Tu usuario",
  "Usuario ",
  "Solicitud ",
  "Reserva ",
  "Plaza ",
  "Puesto ",
  "Cesión ",
  "Error al obtener",
  "No se puede",
  "No se pudo",
  "Selecciona ",
  "No hay ",
  "La fecha ",
  "El rango ",
  "No existe",
  "No encontrada",
  "No disponible",
  "Error al",
  "Esa ",
  "No es ",
];

function isSafeActionMessage(message: string): boolean {
  const normalizedMessage = message.toLowerCase();
  return SAFE_ERROR_PREFIXES.some((prefix) =>
    normalizedMessage.startsWith(prefix.toLowerCase())
  );
}

// ─── Constructores auxiliares ────────────────────────────────

export function success<T>(data: T): ActionSuccess<T> {
  return { success: true, data };
}

export function error(
  message: string,
  fieldErrors?: Record<string, string[]>
): ActionError {
  return { success: false, error: message, fieldErrors };
}

// ─── Constructor de acciones ─────────────────────────────────

type ActionHandler<TInput, TOutput> = (ctx: {
  parsedInput: TInput;
}) => Promise<TOutput>;

interface ActionBuilder {
  schema: <TInput>(schema: ZodType<TInput>) => {
    action: <TOutput>(
      handler: ActionHandler<TInput, TOutput>
    ) => (input: TInput) => Promise<ActionResult<TOutput>>;
  };
}

/**
 * Crea una Server Action con tipado seguro, validación Zod y gestión de errores.
 *
 * Todas las acciones devuelven `ActionResult<T>` — nunca lanzan excepciones.
 * Los errores de validación se devuelven como `fieldErrors`.
 * Los errores inesperados se capturan y se devuelven como mensaje genérico.
 */
export const actionClient: ActionBuilder = {
  schema<TInput>(schema: ZodType<TInput>) {
    return {
      action<TOutput>(handler: ActionHandler<TInput, TOutput>) {
        return async (input: TInput): Promise<ActionResult<TOutput>> => {
          try {
            // Validar entrada
            const result = schema.safeParse(input);

            if (!result.success) {
              const fieldErrors: Record<string, string[]> = {};
              for (const issue of result.error.issues) {
                const path = issue.path.join(".");
                if (!fieldErrors[path]) fieldErrors[path] = [];
                fieldErrors[path].push(issue.message);
              }
              return error("Datos inválidos", fieldErrors);
            }

            // Ejecutar handler
            const data = await handler({ parsedInput: result.data });
            return success(data);
          } catch (err) {
            // Next.js uses NEXT_REDIRECT internally for redirect() calls.
            // Re-throw so Next.js can handle the redirect properly.
            if (
              err instanceof Error &&
              (err.message === "NEXT_REDIRECT" ||
                err.message === "NEXT_NOT_FOUND")
            ) {
              throw err;
            }

            // Evitar volcar stack traces completos en producción.
            if (err instanceof Error) {
              console.error("[action] error inesperado", {
                name: err.name,
                message: err.message,
              });
              if (process.env.NODE_ENV !== "production") {
                console.error("[action] stack", err.stack);
              }
            } else {
              console.error("[action] error inesperado no estándar");
            }
            return error(
              err instanceof Error && isSafeActionMessage(err.message)
                ? err.message
                : "Ha ocurrido un error inesperado"
            );
          }
        };
      },
    };
  },
};
