// =============================================================================
// hooks/useCifraAnimada.ts — Una cifra que sube (o baja) poco a poco hasta su valor
//
// La misma animación de animarCifra (src/nucleo/juego.ts): salida suave (cúbica) con
// requestAnimationFrame (en OBS siempre corre). Como allí, la animación nueva arranca desde
// el valor ANTERIOR pedido, y con `animar: false` (p. ej. al cambiar la configuración o al
// reiniciar la ronda) el número salta directo.
//
//   const mostrado = useCifraAnimada(puntos, { ms: 700, animar: causa === 'regalo' });
// =============================================================================

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export function useCifraAnimada(valor: number, { ms = 700, animar = true }: { ms?: number; animar?: boolean } = {}): number {
  const [mostrado, setMostrado] = useState(valor);
  const objetivo = useRef(valor);
  const animacion = useRef(0);
  const opciones = useRef({ ms, animar });
  opciones.current = { ms, animar };

  useLayoutEffect(() => {
    const desde = objetivo.current;
    if (desde === valor) return;
    objetivo.current = valor;
    cancelAnimationFrame(animacion.current);
    const { ms: duracion, animar: conAnimacion } = opciones.current;
    if (!conAnimacion) {
      setMostrado(valor);
      return;
    }
    const inicio = performance.now();
    const paso = (ahora: number): void => {
      const avance = Math.min(1, (ahora - inicio) / duracion);
      setMostrado(Math.round(desde + (valor - desde) * (1 - (1 - avance) ** 3)));
      if (avance < 1) animacion.current = requestAnimationFrame(paso);
    };
    animacion.current = requestAnimationFrame(paso);
  }, [valor]);

  useEffect(() => () => cancelAnimationFrame(animacion.current), []);
  return mostrado;
}
