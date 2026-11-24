// =============================================================================
// widgets/pantalla/motor.ts — Cuentas del widget "Bailarinas en pantalla" (sin React)
//
// Recibe lo que devuelve leer_pantalla (supabase/pantalla.sql: el LIVE del último regalo
// anotado) y arma lo que se pinta: las tarjetas (con la meta y los apoyos) o los créditos.
// Un LIVE ya no vale cuando el panel empezó uno nuevo después de su último regalo (`dsd`) o
// cuando pasó demasiado sin regalos (el registro empieza otro tras 2 horas): entonces todo va en 0.
// En la vista previa del panel (?prueba=1), sin datos de verdad se muestran unos de ejemplo, y
// los botones de prueba suman monedas (solo en esa vista previa).
// Secciones: 1. Datos · 2. Vigencia · 3. Meta · 4. Tarjetas · 5. Créditos · 6. Vista previa
// =============================================================================

import type { BailarinaEnPantalla, LiveEnPantalla } from '../../nucleo/nube';
import type { AjustesPantallaWidget, BailarinaPantalla } from './config';

/** El registro empieza otro LIVE tras 2 horas sin regalos (ver widgets/registro/motor.ts). */
export const LIVE_VENCIDO_MS = 2 * 3600 * 1000;
/** Los créditos todavía sirven un rato después del LIVE (se suelen pasar al cerrar). */
export const CREDITOS_VENCIDOS_MS = 12 * 3600 * 1000;
export const LEER_TARJETAS_MS = 4000;
export const LEER_CREDITOS_MS = 30000;
export const PERSONAS_CREDITOS = 300;


// -----------------------------------------------------------------------------
// 1. Datos de Supabase, normalizados
// -----------------------------------------------------------------------------

export const LIVE_VACIO: LiveEnPantalla = { sesion: '', desde: 0, hasta: 0, ahora: 0, bailarinas: [] };

const monedas = (n: unknown): number => Math.max(0, Math.round((Number(n) || 0) * 100) / 100);

export function normalizarLive(x: unknown): LiveEnPantalla {
  const d = (x && typeof x === 'object' ? x : {}) as Partial<LiveEnPantalla>;
  const bailarinas: BailarinaEnPantalla[] = (Array.isArray(d.bailarinas) ? d.bailarinas : [])
    .filter((b) => b && typeof b === 'object' && String(b.b || ''))
    .map((b) => ({
      b: String(b.b),
      m: monedas(b.m),
      p: Math.max(0, Math.round(Number(b.p) || 0)),
      f: (Array.isArray(b.f) ? b.f : [])
        .filter((f): f is [string, number] => Array.isArray(f) && String(f[0] ?? '').trim() !== '')
        .map((f) => [String(f[0]).trim().slice(0, 40), monedas(f[1])] as [string, number]),
    }));
  return {
    sesion: String(d.sesion || ''),
    desde: Number(d.desde) || 0,
    hasta: Number(d.hasta) || 0,
    ahora: Number(d.ahora) || 0,
    bailarinas,
  };
}


// -----------------------------------------------------------------------------
// 2. ¿El LIVE leído sigue siendo el de ahora?
// -----------------------------------------------------------------------------

/**
 * `desde` = hora del último «LIVE nuevo» del panel (0 = nunca) · `vence` = cuánto sin regalos
 * lo da por terminado. Se compara con la hora del servidor (`ahora`) para no depender del
 * reloj de este computador.
 */
export function vigente(live: LiveEnPantalla, desde: number, vence: number): boolean {
  if (!live.sesion || !live.hasta) return false;
  if (desde && live.hasta < desde) return false;
  return !live.ahora || live.ahora - live.hasta <= vence;
}


// -----------------------------------------------------------------------------
// 3. Meta de la noche
// -----------------------------------------------------------------------------

export interface ProgresoMeta {
  /** La meta que se muestra ahora («1.250 / 2.000»). */
  objetivo: number;
  /** De 0 a 1: cuánto se llenó la barra. */
  fraccion: number;
  /** Cuántas veces se cumplió la meta (con la escalonada, puede ser más de 1). */
  cumplidas: number;
}

/**
 * Sin escalonar: la barra se llena hasta la meta y se queda llena. Escalonada: al cumplirla, la
 * meta sube otro tanto (1.000 → 2.000 → 3.000…) y la barra muestra lo que lleva hacia la siguiente.
 */
export function progresoMeta(lleva: number, meta: number, escalonada: boolean): ProgresoMeta {
  const m = Math.max(1, meta);
  const cumplidas = Math.floor(Math.max(0, lleva) / m + 1e-9);
  if (!escalonada) return { objetivo: m, fraccion: Math.min(1, Math.max(0, lleva) / m), cumplidas: Math.min(1, cumplidas) };
  const objetivo = (cumplidas + 1) * m;
  return { objetivo, fraccion: Math.min(1, Math.max(0, lleva) / objetivo), cumplidas };
}


// -----------------------------------------------------------------------------
// 4. Tarjetas
// -----------------------------------------------------------------------------

export interface Tarjeta {
  bailarina: BailarinaPantalla;
  monedas: number;
  personas: number;
  fans: [string, number][];
  meta: ProgresoMeta;
}

/** Una tarjeta por bailarina elegida (en su orden o, con `ordenar`, la que más lleva primero). */
export function armarTarjetas(cfg: AjustesPantallaWidget, live: LiveEnPantalla): Tarjeta[] {
  const datos = new Map(live.bailarinas.map((b) => [b.b, b]));
  const tarjetas = cfg.bailarinas.map((bailarina): Tarjeta => {
    const d = datos.get(bailarina.id);
    const lleva = d?.m || 0;
    return {
      bailarina,
      monedas: lleva,
      personas: d?.p || 0,
      fans: (d?.f || []).slice(0, cfg.fans),
      meta: progresoMeta(lleva, bailarina.meta || cfg.meta, cfg.escalonada),
    };
  });
  if (cfg.ordenar) {
    // sort es estable: con las mismas monedas, se respeta el orden del panel.
    tarjetas.sort((a, b) => b.monedas - a.monedas);
  }
  return tarjetas;
}


// -----------------------------------------------------------------------------
// 5. Créditos
// -----------------------------------------------------------------------------

export interface GrupoCreditos {
  bailarina: BailarinaPantalla;
  monedas: number;
  personas: [string, number][];
}

/** Un grupo por bailarina que recibió algo, de la que más generó a la que menos. */
export function armarCreditos(cfg: AjustesPantallaWidget, live: LiveEnPantalla): GrupoCreditos[] {
  const porId = new Map(cfg.bailarinas.map((b) => [b.id, b]));
  return live.bailarinas
    .filter((d) => porId.has(d.b) && d.f.length)
    .map((d) => ({ bailarina: porId.get(d.b) as BailarinaPantalla, monedas: d.m, personas: d.f }))
    .sort((a, b) => b.monedas - a.monedas);
}


// -----------------------------------------------------------------------------
// 6. Vista previa del panel: datos de ejemplo y pruebas
// -----------------------------------------------------------------------------

const APODOS = ['Luna', 'Mateo', 'Sofi', 'Andrés', 'Vale', 'Camilo', 'Isa', 'Tomás', 'Majo', 'Juanes', 'Sara', 'Nico'];

/** Un LIVE inventado (siempre el mismo) para ver cómo queda el widget antes del LIVE. */
export function liveDeEjemplo(cfg: AjustesPantallaWidget, ahora: number): LiveEnPantalla {
  const n = cfg.bailarinas.length;
  return {
    sesion: 'ejemplo', desde: ahora, hasta: ahora, ahora,
    bailarinas: cfg.bailarinas.map((b, i) => {
      const meta = b.meta || cfg.meta;
      const m = Math.round(meta * (n > 1 ? 0.92 - (0.6 * i) / (n - 1) : 0.64));
      const fans: [string, number][] = [0, 1, 2, 3, 4].map((j) => [
        APODOS[(i * 3 + j) % APODOS.length] as string,
        Math.round((m * [0.34, 0.22, 0.14, 0.08, 0.05][j]!)),
      ]);
      return { b: b.id, m, p: 5 + i, f: fans };
    }),
  };
}

/**
 * Suma una prueba del panel: el regalo va a la bailarina de ese activador (o a la primera) y
 * a nombre de `usuario`. Devuelve un LIVE nuevo (no cambia el que recibe).
 */
export function sumarPrueba(cfg: AjustesPantallaWidget, live: LiveEnPantalla, giftId: string, usuario: string, valor: number): LiveEnPantalla {
  const destino = cfg.bailarinas.find((b) => b.giftId && b.giftId === giftId) || cfg.bailarinas[0];
  if (!destino || valor <= 0) return live;
  const bailarinas = live.bailarinas.map((b) => ({ ...b, f: b.f.map((f) => [...f] as [string, number]) }));
  let d = bailarinas.find((b) => b.b === destino.id);
  if (!d) {
    d = { b: destino.id, m: 0, p: 0, f: [] };
    bailarinas.push(d);
  }
  d.m = monedas(d.m + valor);
  const fan = d.f.find((f) => f[0] === usuario);
  if (fan) fan[1] = monedas(fan[1] + valor);
  else {
    d.f.push([usuario, monedas(valor)]);
    d.p++;
  }
  d.f.sort((a, b) => b[1] - a[1]);
  bailarinas.sort((a, b) => b.m - a.m);
  return { ...live, sesion: live.sesion || 'prueba', bailarinas };
}
