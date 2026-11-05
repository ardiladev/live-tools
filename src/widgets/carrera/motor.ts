// =============================================================================
// widgets/carrera/motor.ts — Reglas de la "Carrera de regalos" (sin React)
//
// Cada integrante tiene asignado un regalo de TikTok. Cuando alguien lo envía, ese integrante
// suma monedas (precio del regalo × cantidad) y su barra avanza hacia su meta. El reloj de la
// ronda lo maneja el panel (iniciar, pausar, reiniciar) y llega en la configuración.
//
// Reglas (las mismas del widget original, legado/js/widgets/carrera.js):
//   - El regalo se asigna por ID; si ninguno coincide, por el nombre que manda TikTok.
//   - Suma = (precio que manda TikTok, o «Monedas c/u» del panel, o 1) × cantidad (mínimo 1).
//   - Con «solo con el reloj en marcha» (sr ≠ 0) cuenta con el reloj corriendo o en los 3 s de
//     gracia tras el final; en la vista previa (?prueba=1) cuenta siempre.
//   - Los puntos se guardan en este navegador (live-tools:carrera:<w>, o …:url sin `w`) como
//     { ro, p: { id: monedas } }: si OBS recarga la fuente, se conservan. Solo vuelven a 0
//     cuando cambia `ro` (Reiniciar / Nueva ronda).
//   - Si el panel no tenía la imagen del regalo y TikTok la manda, se usa desde ya.
//   - Sonidos: meta alcanzada (660 Hz), "tic" en los últimos 5 s y campana al terminar
//     (solo si se vio terminar).
// =============================================================================

import { crearEstadoObservable, type Observable } from '../../hooks/useMotor';
import {
  buscarPorRegalo, escribirGuardado, leerGuardado, prueba, relojCuenta,
} from '../../nucleo/juego';
import { sonar } from '../../nucleo/sonido';
import type { EventoLive, EventoRegalo } from '../../tipos/eventos';
import type { LecturaReloj, RelojRonda } from '../../tipos/reloj';
import {
  MAX_INTEGRANTES, normalizarIntegrante, type ConfigCarrera, type IntegranteCarrera,
} from './config';

export const CLAVE_PUNTOS = 'live-tools:carrera:';
/** Segundos finales con "tic" de aviso. */
export const AVISO_FINAL_S = 5;

/** "+25" flotante que sube desde la tarjeta de un integrante. */
export interface SumaFlotante {
  id: number;
  integrante: string;
  suma: number;
}

export interface EstadoCarrera {
  titulo: string;
  integrantes: IntegranteCarrera[];
  reloj: RelojRonda;
  soloConReloj: boolean;
  sonido: boolean;
  ronda: number | null;
  /** id del integrante → monedas en esta ronda. */
  puntos: Record<string, number>;
  /** id → imagen que llegó con un regalo (si el panel no la tenía). */
  imagenesAprendidas: Record<string, string>;
  /** false = el último cambio de puntos vino de la configuración (los números saltan, sin animar). */
  animarPuntos: boolean;
  /** Sube con cada repintado de todas las tarjetas (configuración, imagen aprendida): corta las
   *  cuentas que siguieran a medias, como en el original. */
  pintadas: number;
  sumas: SumaFlotante[];
  /** id → cuántas veces recibió un regalo (reinicia la animación "golpe"). */
  golpes: Record<string, number>;
}

export interface MotorCarrera extends Observable<EstadoCarrera> {
  aplicarConfig(cfg: ConfigCarrera): void;
  alEvento(evento: EventoLive): void;
  /** Quita un "+N" cuando termina su animación. */
  quitarSuma(id: number): void;
  /** Sonidos del reloj: se llama cuando cambia el estado o el segundo que se muestra. */
  alPintarReloj(lectura: LecturaReloj): void;
}

const ESTADO_INICIAL: EstadoCarrera = {
  titulo: '',
  integrantes: [],
  reloj: { e: 'listo', d: 300 },
  soloConReloj: true,
  sonido: true,
  ronda: null,
  puntos: {},
  imagenesAprendidas: {},
  animarPuntos: false,
  pintadas: 0,
  sumas: [],
  golpes: {},
};

export function crearMotorCarrera(): MotorCarrera {
  const estado = crearEstadoObservable<EstadoCarrera>(ESTADO_INICIAL);
  let claveGuardado = '';
  let siguienteSuma = 1;
  let estadoAnterior: LecturaReloj['estado'] | null = null;
  let ultimoTic: number | null = null;

  /** Los puntos guardados de la ronda `ronda` (nada guardado de esta ronda = empieza en 0). */
  function restaurarPuntos(ronda: number): Record<string, number> {
    const guardado = leerGuardado<{ ro: number; p: Record<string, unknown> }>(claveGuardado);
    if (guardado?.ro !== ronda) return {};
    const puntos: Record<string, number> = {};
    for (const [id, valor] of Object.entries(guardado.p || {})) puntos[id] = Math.max(0, Number(valor) || 0);
    return puntos;
  }

  function aplicarConfig(cfg: ConfigCarrera): void {
    claveGuardado = `${CLAVE_PUNTOS}${cfg.w || 'url'}`;
    estado.fijar((e) => {
      const nuevaRonda = Number(cfg.ro) || 0;
      const rondaNueva = nuevaRonda !== e.ronda;
      return {
        ...e,
        integrantes: (Array.isArray(cfg.j) ? cfg.j : []).slice(0, MAX_INTEGRANTES).map(normalizarIntegrante),
        reloj: cfg.t && typeof cfg.t === 'object' ? cfg.t : { e: 'listo', d: 300 },
        soloConReloj: cfg.sr !== 0,
        sonido: cfg.s !== 0,
        titulo: String(cfg.ti || ''),
        // Ronda nueva (el panel pulsó "Reiniciar"): los puntos vuelven a 0 (o a lo guardado de esa ronda).
        ronda: rondaNueva ? nuevaRonda : e.ronda,
        puntos: rondaNueva ? restaurarPuntos(nuevaRonda) : e.puntos,
        animarPuntos: false,
        pintadas: e.pintadas + 1,
      };
    });
  }

  /** ¿Cuenta un regalo que llega ahora? Con el reloj detenido no (salvo que se desactive la opción). */
  function cuentaAhora(e: EstadoCarrera): boolean {
    return prueba || !e.soloConReloj || relojCuenta(e.reloj);
  }

  function alRegalo(evento: EventoRegalo): void {
    const e = estado.obtener();
    const j = buscarPorRegalo(e.integrantes, evento);
    if (!j || !cuentaAhora(e)) return;

    // Si el panel no tenía la imagen del regalo y TikTok la manda, se usa desde ya.
    const imagenesAprendidas = evento.imagen && !j.imagen && !e.imagenesAprendidas[j.id]
      ? { ...e.imagenesAprendidas, [j.id]: evento.imagen }
      : e.imagenesAprendidas;

    // TikTok no siempre manda el precio: entonces vale lo configurado en el panel.
    const suma = (Number(evento.diamantes) || j.valor || 1) * Math.max(1, Number(evento.cantidad) || 1);
    const antes = e.puntos[j.id] || 0;
    const puntos = { ...e.puntos, [j.id]: antes + suma };
    escribirGuardado(claveGuardado, { ro: e.ronda, p: puntos });

    estado.fijar({
      ...e,
      puntos,
      imagenesAprendidas,
      animarPuntos: true,
      // Con una imagen nueva, el original repinta todas las tarjetas.
      pintadas: imagenesAprendidas !== e.imagenesAprendidas ? e.pintadas + 1 : e.pintadas,
      sumas: [...e.sumas, { id: siguienteSuma++, integrante: j.id, suma }],
      golpes: { ...e.golpes, [j.id]: (e.golpes[j.id] || 0) + 1 },
    });
    if (e.sonido && antes < j.meta && antes + suma >= j.meta) sonar({ frecuencia: 660, duracion: 0.6 });
  }

  return {
    obtener: estado.obtener,
    suscribir: estado.suscribir,
    aplicarConfig,
    alEvento(evento) {
      if (evento.tipo === 'regalo') alRegalo(evento);
    },
    quitarSuma(id) {
      estado.fijar((e) => ({ ...e, sumas: e.sumas.filter((s) => s.id !== id) }));
    },
    alPintarReloj({ estado: estadoReloj, restanteMs }) {
      const { sonido } = estado.obtener();
      // "tic" en los últimos segundos y campana al terminar (solo si se vio terminar).
      const segundo = Math.ceil(restanteMs / 1000);
      if (sonido && estadoReloj === 'corre' && segundo <= AVISO_FINAL_S && segundo !== ultimoTic) {
        ultimoTic = segundo;
        sonar({ frecuencia: 990, duracion: 0.08, volumen: 0.08, subida: 1 });
      }
      if (sonido && estadoReloj === 'fin' && estadoAnterior === 'corre') sonar({ frecuencia: 523, duracion: 0.9, subida: 2 });
      estadoAnterior = estadoReloj;
    },
  };
}
