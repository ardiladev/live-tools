// =============================================================================
// hooks/useReiniciarAnimacion.ts — Vuelve a disparar una animación CSS (p. ej. "golpe")
//
// Cada vez que `contador` sube, quita la clase, fuerza un reflujo y la vuelve a poner: así la
// animación arranca de nuevo aunque ya estuviera puesta (lo mismo que hacía el widget original).
// El componente debe incluir la clase en su className cuando `contador` > 0 (React no la quita).
// =============================================================================

import { useLayoutEffect, useRef, type RefObject } from 'react';

export function useReiniciarAnimacion(ref: RefObject<HTMLElement | null>, clase: string, contador: number): void {
  const anterior = useRef(contador);
  useLayoutEffect(() => {
    if (contador === anterior.current) return;
    anterior.current = contador;
    const elemento = ref.current;
    if (!elemento || !contador) return;
    elemento.classList.remove(clase);
    void elemento.offsetWidth; // reinicia la animación
    elemento.classList.add(clase);
  }, [ref, clase, contador]);
}
