import { useSyncExternalStore } from "react";

/**
 * Devuelve true solo en el cliente, false durante SSR.
 *
 * Usa useSyncExternalStore en lugar del patrón
 * useState + useEffect para evitar el warning de ESLint
 * react-hooks/set-state-in-effect, y porque es el enfoque
 * recomendado por React para detectar el entorno SSR/cliente.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}
