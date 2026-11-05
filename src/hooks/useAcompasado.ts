// =============================================================================
// hooks/useAcompasado.ts — Lee una fuente externa y repinta como mucho cada `intervaloMs`
//
// Para lo que cambia muy seguido durante un LIVE (eventos, catálogo de regalos): el primer
// cambio programa un repintado y los que lleguen mientras tanto se juntan en ese mismo (como el
// panel original). Con setTimeout y no requestAnimationFrame: este último se congela con la
// pestaña en segundo plano.
//
//   const estado = useAcompasado(alCambiar, estadoEnVivo, 150);
// =============================================================================

import { useEffect, useRef, useState } from 'react';

export function useAcompasado<T>(
  suscribir: (avisar: () => void) => () => void,
  leer: () => T,
  intervaloMs: number,
): T {
  const [valor, setValor] = useState<T>(leer);
  const leerActual = useRef(leer);
  leerActual.current = leer;

  useEffect(() => {
    let pendiente: ReturnType<typeof setTimeout> | undefined;
    const dejar = suscribir(() => {
      if (pendiente !== undefined) return;
      pendiente = setTimeout(() => {
        pendiente = undefined;
        setValor(() => leerActual.current());
      }, intervaloMs);
    });
    setValor(() => leerActual.current()); // por si cambió entre el primer pintado y la suscripción
    return () => {
      dejar();
      clearTimeout(pendiente);
    };
  }, [suscribir, intervaloMs]);

  return valor;
}
