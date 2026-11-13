// =============================================================================
// widgets/duelo/motor.ts — Reglas del "Duelo VS" (sin React)
//
// Un duelo entre 2 equipos (la bailarina de la izquierda contra la de la derecha) con las MISMAS
// reglas de la Barra de activación: quien envía el activador de un equipo se une a él y desde ahí
// todos sus regalos le suman; las monedas solo suman con el reloj en marcha. Por eso el motor es
// el de la activación (src/widgets/activacion/motor.ts), con su propia clave de guardado
// (live-tools:duelo:<w>) y solo 2 equipos.
//
// Lo propio del duelo es qué le pasa a cada mitad de la pantalla (faseDuelo):
//   juego    → nada todavía
//   amenaza  → últimos 10 s: la mitad de quien va perdiendo empieza a «avisar»
//   conteo   → se acabó el tiempo: 3 s de gracia (los combos del último segundo todavía cuentan)
//   atrapada → la mitad de quien perdió queda presa del efecto (celda, hielo, telaraña, tormenta)
//              y la de quien ganó se ilumina; así se queda hasta la próxima ronda
//   empate   → terminó igualado (o sin monedas): nadie queda atrapada
// =============================================================================

import { crearEstadoObservable } from '../../hooks/useMotor';
import { enGracia } from '../../nucleo/juego';
import type { LecturaReloj, RelojRonda } from '../../tipos/reloj';
import { crearMotorActivacion, quienGana, type EstadoActivacion, type MotorActivacion } from '../activacion/motor';
import {
  CARTEL_GANA, DATOS_EFECTO, eleccionDe, efectoDeRonda, textoCartel,
  type ConfigDuelo, type Efecto, type EleccionEfecto,
} from './config';

export const CLAVE_DUELO = 'live-tools:duelo:';
export const EQUIPOS_DUELO = 2;
/** Desde cuántos ms antes del final la mitad de quien va perdiendo empieza a avisar. */
export const AMENAZA_MS = 10000;

export type FaseDuelo = 'juego' | 'amenaza' | 'conteo' | 'atrapada' | 'empate';

export interface LecturaDuelo {
  fase: FaseDuelo;
  /** Índice de la mitad que pierde (o va perdiendo, en 'amenaza'); null si no hay. */
  perdedor: number | null;
  /** Índice de la mitad que gana (solo en 'atrapada'). */
  ganador: number | null;
}

export interface EstadoDuelo extends EstadoActivacion {
  eleccion: EleccionEfecto;
  /** El efecto de esta ronda (con 'azar', el que tocó). */
  efecto: Efecto;
  /** ¿Avisa la mitad de quien va perdiendo en los últimos segundos? */
  amenaza: boolean;
  cartelPierde: string;
  cartelGana: string;
  /** La ronda (`ro`): las animaciones del efecto vuelven a empezar con cada ronda. */
  ronda: number;
  /** Sonidos encendidos (`s`). */
  sonido: boolean;
}

export type MotorDuelo = Omit<MotorActivacion, 'obtener' | 'suscribir' | 'aplicarConfig'> & {
  obtener(): EstadoDuelo;
  suscribir(fn: () => void): () => void;
  aplicarConfig(cfg: ConfigDuelo): void;
};


// -----------------------------------------------------------------------------
// Qué le pasa a cada mitad (puro)
// -----------------------------------------------------------------------------

export function faseDuelo(
  lectura: LecturaReloj,
  reloj: RelojRonda,
  puntos: readonly number[],
  { ahora = Date.now(), amenaza = true }: { ahora?: number; amenaza?: boolean } = {},
): LecturaDuelo {
  const lider = quienGana(puntos.slice(0, EQUIPOS_DUELO));
  const otro = lider === null ? null : 1 - lider;
  if (lectura.estado === 'fin') {
    if (enGracia(reloj, ahora)) return { fase: 'conteo', perdedor: null, ganador: null };
    return lider === null
      ? { fase: 'empate', perdedor: null, ganador: null }
      : { fase: 'atrapada', perdedor: otro, ganador: lider };
  }
  if (amenaza && lectura.estado === 'corre' && lectura.restanteMs <= AMENAZA_MS && lider !== null) {
    return { fase: 'amenaza', perdedor: otro, ganador: null };
  }
  return { fase: 'juego', perdedor: null, ganador: null };
}


// -----------------------------------------------------------------------------
// Motor: el de la activación + los ajustes del duelo
// -----------------------------------------------------------------------------

export function crearMotorDuelo(): MotorDuelo {
  const base = crearMotorActivacion(CLAVE_DUELO);
  let propio: Omit<EstadoDuelo, keyof EstadoActivacion> = {
    eleccion: 'azar', efecto: efectoDeRonda('azar', 0), amenaza: true,
    cartelPierde: DATOS_EFECTO[efectoDeRonda('azar', 0)].cartel, cartelGana: CARTEL_GANA, ronda: 0, sonido: true,
  };
  const estado = crearEstadoObservable<EstadoDuelo>({ ...base.obtener(), ...propio });
  base.suscribir(() => estado.fijar({ ...base.obtener(), ...propio }));

  return {
    ...base,
    obtener: estado.obtener,
    suscribir: estado.suscribir,
    aplicarConfig(cfg) {
      const eleccion = eleccionDe(cfg.ef);
      const ronda = Number(cfg.ro) || 0;
      const efecto = efectoDeRonda(eleccion, ronda);
      propio = {
        eleccion,
        efecto,
        amenaza: cfg.am !== 0,
        cartelPierde: textoCartel(cfg.tp, DATOS_EFECTO[efecto].cartel),
        cartelGana: textoCartel(cfg.tg, CARTEL_GANA),
        ronda,
        sonido: cfg.s !== 0,
      };
      // Solo 2 equipos (si llegaran más, sobran). El motor publica y la suscripción une todo.
      base.aplicarConfig({ ...cfg, eq: Array.isArray(cfg.eq) ? cfg.eq.slice(0, EQUIPOS_DUELO) : cfg.eq });
    },
  };
}
