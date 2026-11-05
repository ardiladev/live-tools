// =============================================================================
// hooks/useIntervalo.ts — setInterval con la última versión de la función
//
// Se usa setInterval (no requestAnimationFrame) para los relojes: rAF se congela cuando la
// página no se está dibujando (pestañas de fondo), setInterval sigue.
// =============================================================================

import { useEffect, useRef } from 'react';

/** Llama `fn` cada `ms` milisegundos mientras el componente esté montado (`ms` null = pausado). */
export function useIntervalo(fn: () => void, ms: number | null): void {
  const ultima = useRef(fn);
  ultima.current = fn;
  useEffect(() => {
    if (ms === null) return undefined;
    const id = setInterval(() => ultima.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}
