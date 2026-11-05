// =============================================================================
// nucleo/reloj.ts — Reloj de una ronda (lo usan el panel y los widgets de la carrera, el
// marcador, la batalla, la activación y el jefe; el subathon solo usa formatoReloj)
//
// El reloj no cuenta segundos: guarda la HORA en que termina. Así, el panel y el widget en
// OBS muestran lo mismo aunque el cambio tarde un segundo en llegar por Supabase, y el widget
// puede recargarse sin perder la cuenta (ver tipos/reloj.ts y el hook useRondaReloj).
// Ojo: el panel y OBS tienen que tener la hora del computador bien puesta (si están en el
// mismo computador, siempre coinciden).
// (Port 1:1 de legado/js/reloj.js.) Secciones: 1. Leer el estado · 2. Acciones · 3. Formato
// =============================================================================

import type { LecturaReloj, RelojRonda } from '../tipos/reloj';


// -----------------------------------------------------------------------------
// 1. Leer el estado
// -----------------------------------------------------------------------------

/** Cómo está el reloj en este momento. */
export function leerReloj(t: RelojRonda = {}, ahora: number = Date.now()): LecturaReloj {
  const duracionMs = Math.max(1, Number(t.d) || 60) * 1000;
  if (t.e === 'corre') {
    const restanteMs = (Number(t.fin) || 0) - ahora;
    return restanteMs > 0
      ? { estado: 'corre', restanteMs, duracionMs }
      : { estado: 'fin', restanteMs: 0, duracionMs };
  }
  if (t.e === 'pausa') return { estado: 'pausa', restanteMs: Math.max(0, Number(t.r) || 0), duracionMs };
  return { estado: 'listo', restanteMs: duracionMs, duracionMs };
}


// -----------------------------------------------------------------------------
// 2. Acciones (devuelven el reloj nuevo; no modifican el que reciben)
// -----------------------------------------------------------------------------

/** Arranca o reanuda. Desde 'listo' o 'fin' empieza con la duración completa. */
export function iniciarReloj(t: RelojRonda, ahora: number = Date.now()): RelojRonda {
  const { estado, restanteMs, duracionMs } = leerReloj(t, ahora);
  if (estado === 'corre') return { ...t };
  const desde = estado === 'pausa' ? restanteMs : duracionMs;
  return { e: 'corre', d: t.d, fin: ahora + desde, r: 0 };
}

/** Congela el tiempo que queda. */
export function pausarReloj(t: RelojRonda, ahora: number = Date.now()): RelojRonda {
  const { estado, restanteMs } = leerReloj(t, ahora);
  if (estado !== 'corre') return { ...t };
  return { e: 'pausa', d: t.d, fin: 0, r: restanteMs };
}

/** Vuelve a la duración completa, detenido. */
export const reiniciarReloj = (t: RelojRonda): RelojRonda => ({ e: 'listo', d: t.d, fin: 0, r: 0 });


// -----------------------------------------------------------------------------
// 3. Formato
// -----------------------------------------------------------------------------

const dos = (n: number): string => String(n).padStart(2, '0');

/** 83 000 ms → "01:23" · 3 723 000 ms → "1:02:03". Redondea hacia arriba: "00:00" solo al final. */
export function formatoReloj(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${dos(m)}:${dos(s)}` : `${dos(m)}:${dos(s)}`;
}
