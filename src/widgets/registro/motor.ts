// =============================================================================
// widgets/registro/motor.ts — Reglas del widget "Registro de bailarinas" (sin React)
//
// Anota en Supabase cada regalo que le corresponde a cada bailarina, para llevar la cuenta de
// cuánto generó cada una en cada LIVE y quién la apoyó.
//
// Regla (elegida por el usuario el 2026-11-24, «activación de todo el LIVE»):
//   - Quien envía el regalo ACTIVADOR de una bailarina queda «con ella» (ese regalo ya cuenta).
//   - Desde ahí, TODOS sus regalos se le anotan a ella, haya o no un juego corriendo, hasta que
//     envíe el activador de otra (entonces se cambia; lo anotado se queda donde estaba).
//   - Equipos de varias bailarinas (en la batalla, la barra de activación o el duelo): quien
//     envía el regalo del equipo queda con TODAS, y cada regalo suyo se reparte entre ellas en
//     partes iguales (una fila por bailarina con su parte). El regalo del equipo solo une gente
//     mientras ese juego no haya terminado (`sr`, ver config.ts).
//   - Quien no ha activado a nadie no se anota.
//   - Un LIVE = una sesión: tras 2 horas sin regalos (o con «LIVE nuevo» del panel, `ro`) empieza
//     otra y se olvida quién estaba con quién.
// Precio: el que manda TikTok; si no, las «monedas del activador» de esa bailarina (o del
// equipo) si ese regalo es su activador; si no, el del Buscador de regalos (`pr`); si no, 1.
//
// Lo anotado espera en una fila (guardada en este navegador: una recarga o un corte de red no
// pierde nada) y se manda en tandas de hasta 200 cada 1,5 s; si Supabase falla, se reintenta.
// Cada fila tiene su propio id: un reintento nunca la repite. En la vista previa del panel
// (?prueba=1) se ve todo, pero no se manda ni se guarda nada.
// Secciones: 1. Estado · 2. Configuración · 3. Sesión y guardado · 4. Regalos · 5. Envío
// =============================================================================

import { crearEstadoObservable, type Observable } from '../../hooks/useMotor';
import { escribirGuardado, GRACIA_MS, leerGuardado, prueba as modoPrueba } from '../../nucleo/juego';
import { anotarRegalos, idAleatorio, type FilaRegistro } from '../../nucleo/nube';
import { leerReloj } from '../../nucleo/reloj';
import type { EventoLive, EventoRegalo } from '../../tipos/eventos';
import {
  normalizarBailarina, normalizarEquipo,
  type BailarinaRegistro, type ConfigRegistro, type EquipoRegistro,
} from './config';

export const CLAVE_GUARDADO = 'live-tools:registro:';
/** Sin regalos durante este tiempo, el siguiente ya es de otro LIVE. */
export const LIVE_NUEVO_MS = 2 * 3600 * 1000;
export const MAX_ACTIVACIONES = 5000;   // personas recordadas (las más antiguas se olvidan)
export const MAX_PENDIENTES = 5000;     // filas esperando a Supabase (tras un corte muy largo)
export const LOTE = 200;                // filas por envío (el máximo de anotar_regalos)
export const ENVIO_MS = 1500;           // se espera un momento para mandar varias juntas
export const REINTENTOS_MS = [2000, 5000, 15000, 30000, 60000];
export const MAX_ULTIMAS = 12;


// -----------------------------------------------------------------------------
// 1. Estado (lo que se ve en la vista previa)
// -----------------------------------------------------------------------------

export type OrigenAnotacion = FilaRegistro['o'] | 'nadie';

/** Un regalo visto, para la lista de la vista previa. */
export interface Anotacion {
  id: string;
  hora: number;
  usuario: string;
  regalo: string;
  cantidad: number;
  /** Monedas del regalo completo. */
  total: number;
  /** Nombres de las bailarinas a las que se anotó ([] = nadie: esa persona no ha activado a ninguna). */
  para: string[];
  origen: OrigenAnotacion;
}

export interface TotalBailarina {
  id: string;
  nombre: string;
  monedas: number;
}

export interface EstadoRegistro {
  activo: boolean;
  /** Las bailarinas con lo que llevan en este LIVE (de mayor a menor). */
  totales: TotalBailarina[];
  ultimas: Anotacion[];
  /** Filas esperando a Supabase. */
  pendientes: number;
  /** Personas que ya activaron a alguna bailarina en este LIVE. */
  activaciones: number;
  /** Último problema al mandar ('' = todo bien). */
  error: string;
}

export interface MotorRegistro extends Observable<EstadoRegistro> {
  aplicarConfig(cfg: ConfigRegistro): void;
  alEvento(evento: EventoLive): void;
}

export interface OpcionesMotorRegistro {
  ahora?: () => number;
  mandar?: (registro: string, filas: readonly FilaRegistro[]) => Promise<unknown>;
  idNuevo?: () => string;
  prueba?: boolean;
}

/** Lo que se guarda en este navegador (clave live-tools:registro:<w>). */
interface Guardado {
  /** Última `ro` vista. */
  ro: number;
  /** Sesión (LIVE) actual y hora del último regalo. */
  s: string;
  u: number;
  /** Quién está con quién: [persona, ids de bailarinas]. */
  af: [string, string[]][];
  /** Filas sin mandar. */
  pend: FilaRegistro[];
  /** Monedas de cada bailarina en esta sesión. */
  tot: Record<string, number>;
}

const redondear = (n: number): number => Math.round(n * 10000) / 10000;

export function crearMotorRegistro({
  ahora = Date.now, mandar = anotarRegalos, idNuevo = () => idAleatorio(12), prueba = modoPrueba,
}: OpcionesMotorRegistro = {}): MotorRegistro {
  const estado = crearEstadoObservable<EstadoRegistro>({
    activo: true, totales: [], ultimas: [], pendientes: 0, activaciones: 0, error: '',
  });


  // ---------------------------------------------------------------------------
  // 2. Configuración
  // ---------------------------------------------------------------------------
  let registro = '';
  let activo = true;
  let bailarinas = new Map<string, BailarinaRegistro>();
  let activadores = new Map<string, BailarinaRegistro>();  // giftId → bailarina
  let equipos: EquipoRegistro[] = [];
  let precios: Record<string, number> = {};
  let cargado = false;

  function aplicarConfig(cfg: ConfigRegistro): void {
    const lista = (Array.isArray(cfg.bl) ? cfg.bl : []).map(normalizarBailarina).filter((b) => b.id);
    bailarinas = new Map(lista.map((b) => [b.id, b]));
    activadores = new Map();
    for (const b of lista) if (b.giftId && !activadores.has(b.giftId)) activadores.set(b.giftId, b);
    equipos = (Array.isArray(cfg.eq) ? cfg.eq : []).map(normalizarEquipo).filter((e) => e.giftId && e.bailarinas.length);
    precios = cfg.pr && typeof cfg.pr === 'object' ? cfg.pr : {};
    activo = cfg.ac !== 0;

    if (!cargado) {
      cargado = true;
      registro = String(cfg.w || '');
      cargar(registro);
    }
    const ro = Number(cfg.ro) || 0;
    if (ro !== guardado.ro) {
      // La primera configuración solo adopta su `ro`; un cambio después es «LIVE nuevo».
      if (guardado.ro !== -1) nuevaSesion();
      guardado.ro = ro;
      guardar();
    }
    publicar();
    programarEnvio();
  }


  // ---------------------------------------------------------------------------
  // 3. Sesión y guardado
  // ---------------------------------------------------------------------------
  let guardado: Guardado = { ro: -1, s: '', u: 0, af: [], pend: [], tot: {} };
  let activaciones = new Map<string, string[]>();
  let ultimas: Anotacion[] = [];
  let error = '';

  function cargar(w: string): void {
    const previo = leerGuardado<Guardado>(CLAVE_GUARDADO + (w || 'url'));
    if (!previo) return;
    guardado = {
      ro: Number.isFinite(previo.ro) ? Number(previo.ro) : -1,
      s: String(previo.s || ''),
      u: Number(previo.u) || 0,
      af: Array.isArray(previo.af) ? previo.af : [],
      pend: Array.isArray(previo.pend) ? previo.pend.slice(-MAX_PENDIENTES) : [],
      tot: previo.tot && typeof previo.tot === 'object' ? previo.tot : {},
    };
    activaciones = new Map(guardado.af.filter((a) => Array.isArray(a) && Array.isArray(a[1])));
  }

  function guardar(): void {
    guardado.af = [...activaciones];
    escribirGuardado(CLAVE_GUARDADO + (registro || 'url'), guardado);
  }

  /** Empieza otro LIVE: nadie está con nadie y los totales vuelven a 0 (lo pendiente se manda igual). */
  function nuevaSesion(): void {
    guardado.s = '';
    guardado.tot = {};
    activaciones = new Map();
    ultimas = [];
  }

  function publicar(): void {
    const totales = [...bailarinas.values()]
      .map((b) => ({ id: b.id, nombre: b.nombre, monedas: redondear(guardado.tot[b.id] || 0) }))
      .sort((a, b) => b.monedas - a.monedas);
    estado.fijar({ activo, totales, ultimas, pendientes: guardado.pend.length, activaciones: activaciones.size, error });
  }


  // ---------------------------------------------------------------------------
  // 4. Regalos
  // ---------------------------------------------------------------------------

  /** ¿El regalo de este equipo todavía une gente? (hasta que su juego termina). */
  function equipoAbierto(e: EquipoRegistro, momento: number): boolean {
    if (!e.soloConReloj) return true;
    const { estado: reloj } = leerReloj(e.reloj, momento);
    return reloj !== 'fin' || momento - (Number(e.reloj.fin) || 0) < GRACIA_MS;
  }

  /** A quién activa este regalo (y cuánto vale si TikTok no manda el precio), o null. */
  function activacionDe(giftId: string, momento: number): { ids: string[]; origen: FilaRegistro['o']; valor: number } | null {
    const equipo = equipos.find((e) => e.giftId === giftId && equipoAbierto(e, momento));
    if (equipo) {
      const ids = equipo.bailarinas.filter((id) => bailarinas.has(id));
      if (ids.length) return { ids, origen: ids.length > 1 ? 'equipo' : 'activador', valor: equipo.valor };
    }
    const b = activadores.get(giftId);
    return b ? { ids: [b.id], origen: 'activador', valor: b.valor } : null;
  }

  function alRegalo(ev: EventoRegalo): void {
    if (!activo) return;
    const momento = ahora();
    if (!guardado.s || momento - guardado.u > LIVE_NUEVO_MS) {
      if (guardado.s) nuevaSesion();
      guardado.s = idNuevo();
    }
    guardado.u = momento;

    const persona = ev.uid ? `u:${ev.uid}` : `n:${ev.usuario.trim().toLowerCase()}`;
    const giftId = String(ev.giftId);
    const activa = activacionDe(giftId, momento);
    if (activa) {
      activaciones.delete(persona); // al final del mapa: es la más reciente
      activaciones.set(persona, activa.ids);
      while (activaciones.size > MAX_ACTIVACIONES) activaciones.delete(activaciones.keys().next().value as string);
    }
    const ids = (activaciones.get(persona) || []).filter((id) => bailarinas.has(id));

    const cantidad = Math.max(1, Number(ev.cantidad) || 1);
    const precio = Number(ev.diamantes) > 0 ? Number(ev.diamantes)
      : (activa?.valor || Number(precios[giftId]) || 1);
    const total = precio * cantidad;
    const parte = redondear(total / Math.max(1, ids.length));
    const origen: FilaRegistro['o'] = activa ? activa.origen : 'apoyo';

    const filas: FilaRegistro[] = ids.map((id) => ({
      id: idNuevo(), s: guardado.s, b: id, bn: bailarinas.get(id)?.nombre || '',
      u: ev.usuario, uid: ev.uid || '', g: giftId, gn: ev.nombre || '', n: cantidad,
      m: parte, p: total, k: ids.length, o: origen, h: momento,
    }));
    for (const f of filas) guardado.tot[f.b] = redondear((guardado.tot[f.b] || 0) + f.m);
    if (!prueba && filas.length) {
      guardado.pend.push(...filas);
      if (guardado.pend.length > MAX_PENDIENTES) guardado.pend.splice(0, guardado.pend.length - MAX_PENDIENTES);
    }

    const anotacion: Anotacion = {
      id: filas[0]?.id || idNuevo(), hora: momento, usuario: ev.usuario, regalo: ev.nombre || giftId, cantidad, total,
      para: ids.map((id) => bailarinas.get(id)?.nombre || id), origen: ids.length ? origen : 'nadie',
    };
    ultimas = [anotacion, ...ultimas].slice(0, MAX_ULTIMAS);

    guardar();
    publicar();
    programarEnvio();
  }

  function alEvento(evento: EventoLive): void {
    if (evento.tipo === 'regalo') alRegalo(evento);
  }


  // ---------------------------------------------------------------------------
  // 5. Envío a Supabase
  // ---------------------------------------------------------------------------
  let espera: ReturnType<typeof setTimeout> | undefined;
  let enviando = false;
  let intento = 0;

  function programarEnvio(ms = ENVIO_MS): void {
    if (prueba || !registro || espera || enviando || !guardado.pend.length) return;
    espera = setTimeout(() => {
      espera = undefined;
      void enviar();
    }, ms);
  }

  async function enviar(): Promise<void> {
    if (enviando || !guardado.pend.length) return;
    enviando = true;
    const lote = guardado.pend.slice(0, LOTE);
    try {
      await mandar(registro, lote);
      const enviados = new Set(lote.map((f) => f.id));
      guardado.pend = guardado.pend.filter((f) => !enviados.has(f.id));
      intento = 0;
      error = '';
      guardar();
      enviando = false;
      publicar();
      programarEnvio(200);
    } catch (e) {
      enviando = false;
      error = (e as Error).message || 'No se pudo guardar en Supabase';
      console.warn(`[widget] Registro de bailarinas: ${error}. Se reintenta.`);
      const ms = REINTENTOS_MS[Math.min(intento, REINTENTOS_MS.length - 1)] ?? 60000;
      intento++;
      publicar();
      programarEnvio(ms);
    }
  }

  return {
    obtener: estado.obtener,
    suscribir: estado.suscribir,
    aplicarConfig,
    alEvento,
  };
}
