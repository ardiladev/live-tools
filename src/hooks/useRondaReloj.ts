// =============================================================================
// hooks/useRondaReloj.ts — Reloj por rondas dentro de un componente
//
// El reloj viaja como la HORA en que termina la ronda (`t.fin`), no como segundos que
// quedan: por eso, si OBS recarga la fuente, el widget vuelve a calcular lo que falta a
// partir de esa hora y marca lo mismo que el panel (ver src/nucleo/reloj.ts).
// Este hook vuelve a pintar cada `intervaloMs` (setInterval, no requestAnimationFrame: así
// sigue aunque la página no se esté dibujando) y devuelve la lectura del momento.
//
//   const { estado, restanteMs, duracionMs } = useRondaReloj(config.t);
// =============================================================================

import { useState } from 'react';
import { leerReloj } from '../nucleo/reloj';
import type { LecturaReloj, RelojRonda } from '../tipos/reloj';
import { useIntervalo } from './useIntervalo';

export function useRondaReloj(t: RelojRonda | undefined, intervaloMs = 200): LecturaReloj {
  const [, setTic] = useState(0);
  useIntervalo(() => setTic((n) => (n + 1) % 1_000_000), intervaloMs);
  return leerReloj(t ?? {}, Date.now());
}
