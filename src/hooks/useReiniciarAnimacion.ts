// =============================================================================
// hooks/useReiniciarAnimacion.ts — Vuelve a disparar una animación CSS (p. ej. "golpe")
//
// Cada vez que `contador` sube, quita la clase, fuerza un reflujo y la vuelve a poner: así la
// animación arranca de nuevo aunque ya estuviera puesta (lo mismo que hacía el widget original).
// El componente debe incluir la clase en su className cuando corresponda (React no la quita):
// `contador > 0`, o lo que devuelve el hook si el elemento puede montarse de nuevo (una tarjeta
// que sale de la lista y vuelve llega sin la clase, como un nodo recién creado del original).
// =============================================================================

import { useLayoutEffect, useRef, type RefObject } from 'react';

/** Devuelve true si `contador` subió desde que se montó el elemento. */
export function useReiniciarAnimacion(ref: RefObject<HTMLElement | null>, clase: string, contador: number): boolean {
  const alMontar = useRef(contador);
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
  return contador !== alMontar.current;
}
