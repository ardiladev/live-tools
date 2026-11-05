// =============================================================================
// widgets/repertorio/motor.ts — Reglas del "Repertorio" (sin React)
//
// Una lista de canciones o bailes, cada uno con una meta de monedas. Los regalos (precio ×
// cantidad) se suman a la canción ACTIVA; al llegar a su meta queda desbloqueada ("Sonando").
// La persona pasa a la siguiente desde el panel.
//
// Reglas (las mismas del widget original, legado/js/widgets/repertorio.js):
//   - Sin la canción activa en la lista, la activa es la primera no hecha.
//   - Suma = (precio que manda TikTok, o «Monedas de un regalo sin precio») × cantidad (mínimo 1).
//     Una canción hecha no suma.
//   - Las monedas se guardan en este navegador (live-tools:repertorio:<w>, o …:url sin `w`) como
//     { ro, p: { id: monedas } }: si OBS recarga la fuente, se conservan. Solo vuelven a 0
//     cuando cambia `ro` (Reiniciar repertorio).
//   - Destello "golpe" con cada regalo; al desbloquearse, "desbloqueo" (más largo) y dos notas.
// =============================================================================

import { crearEstadoObservable, type Observable } from '../../hooks/useMotor';
import { escribirGuardado, leerGuardado } from '../../nucleo/juego';
import { sonar } from '../../nucleo/sonido';
import type { EventoLive, EventoRegalo } from '../../tipos/eventos';
import { MAX_CANCIONES, normalizarCancion, type Cancion, type ConfigRepertorio } from './config';

export const CLAVE_GUARDADO = 'live-tools:repertorio:';

/** pendiente | activa | sonando (activa y desbloqueada) | hecha */
export type EstadoCancion = 'pendiente' | 'activa' | 'sonando' | 'hecha';

export interface EstadoRepertorio {
  titulo: string;
  canciones: Cancion[];
  /** id de la canción que recibe los regalos ('' = ninguna). */
  activa: string;
  hechas: ReadonlySet<string>;
  /** Cuántas canciones se ven a la vez (3 a 5). */
  visibles: number;
  ronda: number | null;
  /** id de la canción → monedas juntadas en esta ronda. */
  monedas: Record<string, number>;
  /** false = el último cambio vino de la configuración (las cifras saltan, sin animar). */
  animarCifras: boolean;
  /** id → regalos que no la desbloquearon (reinicia la animación "golpe"). */
  golpes: Record<string, number>;
  /** id → veces que se desbloqueó (reinicia la animación "desbloqueo"). */
  desbloqueos: Record<string, number>;
}

export interface MotorRepertorio extends Observable<EstadoRepertorio> {
  aplicarConfig(cfg: ConfigRepertorio): void;
  alEvento(evento: EventoLive): void;
}

const ESTADO_INICIAL: EstadoRepertorio = {
  titulo: '',
  canciones: [],
  activa: '',
  hechas: new Set(),
  visibles: 5,
  ronda: null,
  monedas: {},
  animarCifras: false,
  golpes: {},
  desbloqueos: {},
};

const desbloqueada = (e: EstadoRepertorio, c: Cancion): boolean => (e.monedas[c.id] || 0) >= c.meta;

export function estadoDe(e: EstadoRepertorio, c: Cancion): EstadoCancion {
  if (e.hechas.has(c.id)) return 'hecha';
  if (c.id === e.activa) return desbloqueada(e, c) ? 'sonando' : 'activa';
  return 'pendiente';
}

/** Qué canciones se ven: desde la activa hacia abajo; cerca del final, también las anteriores. */
export function ventana(e: EstadoRepertorio): Cancion[] {
  const indice = Math.max(0, e.canciones.findIndex((c) => c.id === e.activa));
  const desde = Math.max(0, Math.min(indice, e.canciones.length - e.visibles));
  return e.canciones.slice(desde, desde + e.visibles);
}

export function crearMotorRepertorio(): MotorRepertorio {
  const estado = crearEstadoObservable<EstadoRepertorio>(ESTADO_INICIAL);
  let claveGuardado = '';
  let valorRegalo = 1;
  let sonido = true;

  /** Las monedas guardadas de la ronda `ronda` (nada guardado de esta ronda = la lista empieza en 0). */
  function restaurar(ronda: number): Record<string, number> {
    const guardado = leerGuardado<{ ro: number; p: Record<string, unknown> }>(claveGuardado);
    if (guardado?.ro !== ronda) return {};
    const monedas: Record<string, number> = {};
    for (const [id, valor] of Object.entries(guardado.p || {})) monedas[id] = Math.max(0, Number(valor) || 0);
    return monedas;
  }

  /** Aplica una configuración. Puede llegar en cualquier momento (cambios en vivo, órdenes del panel). */
  function aplicarConfig(cfg: ConfigRepertorio): void {
    const canciones = (Array.isArray(cfg.c) ? cfg.c : []).slice(0, MAX_CANCIONES).map(normalizarCancion);
    const hechas = new Set((Array.isArray(cfg.h) ? cfg.h : []).map(String));
    const activa = canciones.some((c) => c.id === String(cfg.a))
      ? String(cfg.a)
      : (canciones.find((c) => !hechas.has(c.id))?.id || '');
    valorRegalo = Math.max(0, Number(cfg.v) || 1);
    sonido = cfg.s !== 0;
    claveGuardado = `${CLAVE_GUARDADO}${cfg.w || 'url'}`;

    estado.fijar((e) => {
      // Ronda nueva (el panel pulsó "Reiniciar repertorio"): todas las canciones vuelven a 0.
      const nuevaRonda = Number(cfg.ro) || 0;
      const rondaNueva = nuevaRonda !== e.ronda;
      return {
        ...e,
        titulo: String(cfg.ti ?? '').slice(0, 30),
        canciones,
        hechas,
        activa,
        visibles: Math.min(5, Math.max(3, Number(cfg.mx) || 5)),
        ronda: rondaNueva ? nuevaRonda : e.ronda,
        monedas: rondaNueva ? restaurar(nuevaRonda) : e.monedas,
        animarCifras: false,
      };
    });
  }

  function alRegalo(evento: EventoRegalo): void {
    const e = estado.obtener();
    const c = e.canciones.find((x) => x.id === e.activa);
    if (!c || e.hechas.has(c.id)) return;
    // TikTok no siempre manda el precio: entonces vale lo configurado en el panel.
    const suma = (Number(evento.diamantes) || valorRegalo) * Math.max(1, Number(evento.cantidad) || 1);
    if (!suma) return;

    const antes = desbloqueada(e, c);
    const monedas = { ...e.monedas, [c.id]: (e.monedas[c.id] || 0) + suma };
    escribirGuardado(claveGuardado, { ro: e.ronda, p: monedas });
    const desbloqueo = !antes && (monedas[c.id] || 0) >= c.meta;

    estado.fijar({
      ...e,
      monedas,
      animarCifras: true,
      golpes: desbloqueo ? e.golpes : { ...e.golpes, [c.id]: (e.golpes[c.id] || 0) + 1 },
      desbloqueos: desbloqueo ? { ...e.desbloqueos, [c.id]: (e.desbloqueos[c.id] || 0) + 1 } : e.desbloqueos,
    });
    if (desbloqueo && sonido) {
      sonar({ frecuencia: 523, duracion: 0.4, subida: 1.5 });
      setTimeout(() => sonar({ frecuencia: 784, duracion: 0.8, subida: 1.5 }), 200);
    }
  }

  return {
    obtener: estado.obtener,
    suscribir: estado.suscribir,
    aplicarConfig,
    alEvento(evento) {
      if (evento.tipo === 'regalo') alRegalo(evento);
    },
  };
}
