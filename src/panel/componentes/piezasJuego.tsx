// =============================================================================
// panel/componentes/piezasJuego.tsx — Piezas con interfaz que comparten las vistas de juegos
//
//   - useRelojDeRonda: el reloj de la ronda de un juego (Iniciar / Pausar / Reiniciar). Guarda
//     en los ajustes del widget `reloj` (hora de término, ver src/nucleo/reloj.ts) y `ronda`
//     (cambia cuando los puntos deben volver a 0) y SUBE el cambio a Supabase al instante
//     (sincronizar.subir: las órdenes de juego no esperan los 0,6 s).
//   - <PanelReloj> tiempo grande y estado · <BotonesReloj> Iniciar/Reanudar/Nueva ronda + Pausar
//   - <CampoDuracion> segundos de la ronda con su equivalente («= 5:00»)
//   - <ListaRegalos> <datalist> con los regalos del Buscador (sugerencias de IDs)
// (Port de las secciones 2 y 3 de legado/js/panel/piezas.js.)
// =============================================================================

import type { Draft } from 'immer';
import { useMemo } from 'react';
import { useRondaReloj } from '../../hooks/useRondaReloj';
import { formatoReloj, iniciarReloj, leerReloj, pausarReloj, reiniciarReloj } from '../../nucleo/reloj';
import type { LecturaReloj, RelojRonda } from '../../tipos/reloj';
import { nombreRegalo, usarAlmacen } from '../estado/almacen';
import { subir } from '../estado/sincronizar';
import { DURACION_MAX_S, DURACION_MIN_S, TEXTOS_RELOJ, type TextosReloj } from '../piezas';
import { Campo } from './ui';


// -----------------------------------------------------------------------------
// 1. Reloj de la ronda
// -----------------------------------------------------------------------------

/** Lo mínimo que guardan los ajustes de un juego con reloj por rondas. */
export interface AjustesConReloj {
  reloj: RelojRonda;
  ronda?: number;
  [clave: string]: unknown;
}

export interface RelojDeRonda {
  /** Lectura del momento (se repinta cada 250 ms). */
  lectura: LecturaReloj;
  textos: TextosReloj;
  /** El reloj guardado con la duración actual. */
  actual: () => RelojRonda;
  terminada: () => boolean;
  /** Guarda el reloj (y empieza otra ronda si `nuevaRonda`) y lo manda a OBS de inmediato. */
  aplicar: (nuevo: RelojRonda, opciones?: { nuevaRonda?: boolean }) => void;
  /** Desde "Final", iniciar es empezar una ronda nueva (puntos en 0). */
  iniciar: () => void;
  pausar: () => void;
  /** Reloj detenido con la duración completa y puntos en 0. */
  reiniciar: () => void;
}

/**
 * El reloj de la ronda de una vista.
 *   id:             el widget (para subir el cambio al instante)
 *   ajustes:        sus ajustes (de ahí se leen `reloj` y `ronda`)
 *   cambiarAjustes: la función de useAjustesWidget para guardarlos
 *   duracionS:      segundos de la ronda (ya acotados)
 */
export function useRelojDeRonda<T extends AjustesConReloj>({ id, ajustes, cambiarAjustes, duracionS, textos = TEXTOS_RELOJ }: {
  id: string;
  ajustes: T;
  cambiarAjustes: (receta: (a: Draft<T>) => void) => void;
  duracionS: number;
  textos?: TextosReloj;
}): RelojDeRonda {
  const actual = (): RelojRonda => ({ ...ajustes.reloj, d: duracionS });
  const lectura = useRondaReloj(actual(), 250);

  const aplicar: RelojDeRonda['aplicar'] = (nuevo, { nuevaRonda = false } = {}) => {
    cambiarAjustes((a) => {
      (a as AjustesConReloj).reloj = { e: nuevo.e, fin: nuevo.fin, r: nuevo.r };
      if (nuevaRonda) (a as AjustesConReloj).ronda = Date.now();
    });
    void subir(id);
  };
  const terminada = (): boolean => leerReloj(actual()).estado === 'fin';

  return {
    lectura,
    textos,
    actual,
    terminada,
    aplicar,
    iniciar() {
      const fin = terminada();
      aplicar(iniciarReloj(fin ? reiniciarReloj(actual()) : actual()), { nuevaRonda: fin });
    },
    pausar() {
      aplicar(pausarReloj(actual()));
    },
    reiniciar() {
      aplicar(reiniciarReloj(actual()), { nuevaRonda: true });
    },
  };
}

/** Tiempo grande y su estado (verde corriendo, dorado al terminar). `oculto`: con el atributo hidden. */
export function PanelReloj({ reloj, oculto = false }: { reloj: RelojDeRonda; oculto?: boolean }) {
  const { estado, restanteMs } = reloj.lectura;
  return (
    <div className="reloj-panel" hidden={oculto}>
      <div className="reloj-tiempo" role="timer" data-estado={estado}>{formatoReloj(restanteMs)}</div>
      <div className="reloj-estado">{reloj.textos[estado][0]}</div>
    </div>
  );
}

/** Botones Iniciar (Reanudar / Nueva ronda según el estado) y Pausar. `oculto`: con el atributo hidden. */
export function BotonesReloj({ reloj, oculto = false }: { reloj: RelojDeRonda; oculto?: boolean }) {
  const { estado } = reloj.lectura;
  return (
    <>
      <button className="principal" onClick={reloj.iniciar} disabled={estado === 'corre'} hidden={oculto}>{reloj.textos[estado][1]}</button>
      <button onClick={reloj.pausar} disabled={estado !== 'corre'} hidden={oculto}>Pausar</button>
    </>
  );
}


// -----------------------------------------------------------------------------
// 2. Duración de la ronda
// -----------------------------------------------------------------------------

/** Campo de la duración en segundos, con su equivalente en minutos debajo («= 5:00»). */
export function CampoDuracion({ etiqueta, valor, duracionS, alCambiar, oculto = false }: {
  etiqueta: string;
  /** Con el atributo hidden (p. ej. la batalla sin cronómetro). */
  oculto?: boolean;
  /** Lo que está guardado (puede estar a medio escribir). */
  valor: number | string;
  /** La duración ya acotada (lo que de verdad usa el reloj). */
  duracionS: number;
  alCambiar: (segundos: number) => void;
}) {
  return (
    <>
      <div className="campos duracion separado-arriba" hidden={oculto}>
        <Campo etiqueta={etiqueta} tipo="number" valor={valor} min={DURACION_MIN_S} max={DURACION_MAX_S} step={10} alCambiar={alCambiar} />
      </div>
      <span className="nota sin-margen" hidden={oculto}>{`= ${formatoReloj(duracionS * 1000)}`}</span>
    </>
  );
}


// -----------------------------------------------------------------------------
// 3. Lista de regalos del Buscador
// -----------------------------------------------------------------------------

/** Un <datalist> con los regalos del Buscador, los más vistos primero. Úsalo con <input list={id}>. */
export function ListaRegalos({ id }: { id: string }) {
  const regalos = usarAlmacen((e) => e.regalos);
  const ordenados = useMemo(() => Object.values(regalos).sort((a, b) => (b.veces || 0) - (a.veces || 0)), [regalos]);
  return (
    <datalist id={id}>
      {ordenados.map((r) => (
        <option
          key={r.giftId}
          value={r.giftId}
          label={`${nombreRegalo(r) || 'Sin nombre'}${r.diamantes ? ` · ${r.diamantes} monedas` : ''}`}
        />
      ))}
    </datalist>
  );
}
