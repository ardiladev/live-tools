// =============================================================================
// hooks/useCifraAnimada.ts — Una cifra que sube (o baja) poco a poco hasta su valor
//
// La misma animación de animarCifra (src/nucleo/juego.ts): salida suave (cúbica) con
// requestAnimationFrame (en OBS siempre corre). Como allí:
//   - la animación nueva arranca desde el valor ANTERIOR pedido;
//   - con `animar: false` (p. ej. al cambiar la configuración o al reiniciar la ronda) el número
//     salta directo, y si había una animación a medias, se corta y queda en el valor final.
//
//   const mostrado = useCifraAnimada(puntos, { ms: 700, animar: causa === 'regalo' });
// =============================================================================

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export function useCifraAnimada(valor: number, { ms = 700, animar = true }: { ms?: number; animar?: boolean } = {}): number {
  const [mostrado, setMostrado] = useState(valor);
  const objetivo = useRef(valor);
  const animacion = useRef(0);
  const enCurso = useRef(false);
  const duracion = useRef(ms);
  duracion.current = ms;

  useLayoutEffect(() => {
    const desde = objetivo.current;
    if (desde === valor) {
      // Mismo valor sin animar (llegó una configuración): una animación a medias salta al final.
      if (!animar && enCurso.current) {
        cancelAnimationFrame(animacion.current);
        enCurso.current = false;
        setMostrado(valor);
      }
      return;
    }
    objetivo.current = valor;
    cancelAnimationFrame(animacion.current);
    if (!animar) {
      enCurso.current = false;
      setMostrado(valor);
      return;
    }
    enCurso.current = true;
    const inicio = performance.now();
    const paso = (ahora: number): void => {
      const avance = Math.min(1, (ahora - inicio) / duracion.current);
      setMostrado(Math.round(desde + (valor - desde) * (1 - (1 - avance) ** 3)));
      if (avance < 1) animacion.current = requestAnimationFrame(paso);
      else enCurso.current = false;
    };
    animacion.current = requestAnimationFrame(paso);
  }, [valor, animar]);

  useEffect(() => () => cancelAnimationFrame(animacion.current), []);
  return mostrado;
}
