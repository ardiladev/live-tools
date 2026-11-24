// =============================================================================
// widgets/jefe/motorMascota.ts — Modo «Mascota del LIVE» del Jefe (jefe.html con md: 'mascota')
//
// En vez de un jefe al que se le quita vida, una mascota que CRECE con el público:
//   - cada regalo le da de comer: (precio × cantidad; sin precio, `v`) × `dr` puntos;
//   - cada like la alegra (corazones) y le da `dl` puntos;
//   - cada `hp` puntos sube de nivel (5 niveles: Bebé → Leyenda); con cada nivel se ve más grande
//     y gana un adorno (brote, moño, capa, corona);
//   - si nadie escribe en el chat durante `zz` segundos, se duerme (zzz); un mensaje del chat o
//     un regalo la despiertan.
// Los puntos se guardan en live-tools:mascota:<w> como { ro, p } (una recarga no la encoge);
// `ro` nueva = vuelve a ser bebé. No usa reloj.
// Secciones: 1. Niveles · 2. Estado · 3. Motor
// =============================================================================

import { crearEstadoObservable, type Observable } from '../../hooks/useMotor';
import { multiplicador, type HoraFeliz } from '../../nucleo/conteo';
import { escribirGuardado, leerGuardado } from '../../nucleo/juego';
import { sonar } from '../../nucleo/sonido';
import type { EventoLive } from '../../tipos/eventos';
import type { ConfigJefe } from './config';

export const CLAVE_MASCOTA = 'live-tools:mascota:';
export const NIVELES = ['Bebé', 'Pequeña', 'Juguetona', 'Grande', 'Leyenda'] as const;
export const NIVEL_MAX = NIVELES.length;
/** Cuánto dura la cara feliz tras un like y la de comer tras un regalo (ms). */
export const FELIZ_MS = 1600;
export const COMIENDO_MS = 2200;
export const COLOR_MASCOTA = '#FFC94D';


// -----------------------------------------------------------------------------
// 1. Niveles
// -----------------------------------------------------------------------------

export interface Nivel {
  /** 1 … 5 */
  nivel: number;
  nombre: string;
  /** De 0 a 1: cuánto le falta para el siguiente (1 en el último). */
  progreso: number;
  /** Puntos que lleva dentro del nivel y los que necesita. */
  lleva: number;
  necesita: number;
}

export function nivelDe(puntos: number, porNivel: number): Nivel {
  const pn = Math.max(1, porNivel);
  const nivel = Math.min(NIVEL_MAX, 1 + Math.floor(Math.max(0, puntos) / pn));
  if (nivel >= NIVEL_MAX) return { nivel, nombre: NIVELES[NIVEL_MAX - 1] ?? '', progreso: 1, lleva: pn, necesita: pn };
  const lleva = Math.max(0, puntos) - (nivel - 1) * pn;
  return { nivel, nombre: NIVELES[nivel - 1] ?? '', progreso: lleva / pn, lleva, necesita: pn };
}

export type Animo = 'normal' | 'feliz' | 'comiendo' | 'dormida';

/** El ánimo en este momento: dormida manda (si nadie la despertó), luego comer y luego feliz. */
export function animoDe(e: Pick<EstadoMascota, 'despierta' | 'ultimoLike' | 'ultimoRegalo' | 'segundosSueno'>, ahora: number): Animo {
  if (e.segundosSueno > 0 && ahora - e.despierta > e.segundosSueno * 1000) return 'dormida';
  if (ahora - e.ultimoRegalo < COMIENDO_MS) return 'comiendo';
  if (ahora - e.ultimoLike < FELIZ_MS) return 'feliz';
  return 'normal';
}


// -----------------------------------------------------------------------------
// 2. Estado
// -----------------------------------------------------------------------------

export interface EstadoMascota {
  nombre: string;
  color: string;
  porNivel: number;
  ronda: number | null;
  puntos: number;
  /** Segundos sin chat para dormirse (0 = nunca). */
  segundosSueno: number;
  /** Última vez que la despertaron (chat o regalo) y último like y regalo (ms). */
  despierta: number;
  ultimoLike: number;
  ultimoRegalo: number;
  /** «Fulano le dio de comer» ('' al empezar). */
  ultimaAccion: string;
  /** Cuántos likes (reinicia los corazones) y cuántas subidas de nivel (reinicia la celebración). */
  corazones: number;
  subidas: number;
  /** false = el último cambio de puntos vino de la configuración (la barra salta). */
  animar: boolean;
}

export interface MotorMascota extends Observable<EstadoMascota> {
  aplicarConfig(cfg: ConfigJefe): void;
  alEvento(evento: EventoLive): void;
}


// -----------------------------------------------------------------------------
// 3. Motor
// -----------------------------------------------------------------------------

export function crearMotorMascota({ ahora = Date.now }: { ahora?: () => number } = {}): MotorMascota {
  const estado = crearEstadoObservable<EstadoMascota>({
    nombre: 'Mascota', color: COLOR_MASCOTA, porNivel: 1000, ronda: null, puntos: 0, segundosSueno: 60,
    despierta: ahora(), ultimoLike: 0, ultimoRegalo: 0, ultimaAccion: '', corazones: 0, subidas: 0, animar: false,
  });
  let porLike = 1;
  let porMoneda = 10;
  let valorRegalo = 1;
  let sonido = true;
  let clave = '';
  let horaFeliz: HoraFeliz | undefined;

  function aplicarConfig(cfg: ConfigJefe): void {
    horaFeliz = cfg.hf;
    porLike = Math.max(0, Number(cfg.dl ?? 1));
    porMoneda = Math.max(0, Number(cfg.dr ?? 10));
    valorRegalo = Math.max(0, Number(cfg.v) || 1);
    sonido = cfg.s !== 0;
    clave = `${CLAVE_MASCOTA}${cfg.w || 'url'}`;
    estado.fijar((e) => {
      const ronda = Number(cfg.ro) || 0;
      let puntos = e.puntos;
      if (ronda !== e.ronda) {
        const guardado = leerGuardado<{ ro: number; p: unknown }>(clave);
        puntos = guardado?.ro === ronda ? Math.max(0, Number(guardado.p) || 0) : 0;
      }
      return {
        ...e,
        nombre: String(cfg.ti || 'Mascota').slice(0, 30),
        color: /^#[0-9a-f]{6}$/i.test(String(cfg.mc)) ? String(cfg.mc) : COLOR_MASCOTA,
        porNivel: Math.max(1, Math.round(Number(cfg.hp) || 1000)),
        segundosSueno: Math.max(0, Math.round(Number(cfg.zz ?? 60))),
        ...(ronda !== e.ronda ? { ronda, puntos, ultimaAccion: '' } : {}),
        animar: false,
      };
    });
  }

  function sumar(e: EstadoMascota, puntos: number, cambios: Partial<EstadoMascota>): void {
    const antes = nivelDe(e.puntos, e.porNivel).nivel;
    const total = e.puntos + puntos;
    const despues = nivelDe(total, e.porNivel).nivel;
    escribirGuardado(clave, { ro: e.ronda, p: total });
    if (despues > antes && sonido) {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => sonar({ frecuencia: f, duracion: 0.3, volumen: 0.1, onda: 'triangle', subida: 1 }), i * 120));
    }
    estado.fijar({ ...e, ...cambios, puntos: total, subidas: e.subidas + (despues > antes ? 1 : 0), animar: true });
  }

  function alEvento(evento: EventoLive): void {
    const e = estado.obtener();
    const t = ahora();
    if (evento.tipo === 'chat') {
      estado.fijar({ ...e, despierta: t });
      return;
    }
    if (evento.tipo === 'like') {
      const puntos = Math.max(0, Number(evento.cantidad) || 0) * porLike;
      // Los likes la alegran, pero no la despiertan (para eso, el chat).
      sumar(e, puntos, { ultimoLike: t, corazones: e.corazones + 1 });
      return;
    }
    if (evento.tipo === 'regalo') {
      const monedas = (Number(evento.diamantes) || valorRegalo) * Math.max(1, Number(evento.cantidad) || 1) * multiplicador(horaFeliz);
      if (sonido) sonar({ frecuencia: 660, duracion: 0.12, volumen: 0.08, onda: 'triangle', subida: 1.3 });
      sumar(e, monedas * porMoneda, {
        ultimoRegalo: t, despierta: t, ultimaAccion: `${evento.usuario || 'Alguien'} le dio de comer`,
      });
    }
  }

  return { obtener: estado.obtener, suscribir: estado.suscribir, aplicarConfig, alEvento };
}
