// =============================================================================
// widgets/meta/motor.ts — Reglas del widget "Meta" (sin React)
//
// El conteo empieza en 0 cada vez que se abre la fuente en OBS. Un cambio en vivo no lo
// borra (salvo que cambie el tipo de meta, porque entonces cuenta otra cosa). Si la persona
// cambia la meta en el panel, manda la suya; si no, se respeta la que se duplicó en el LIVE.
// Al alcanzarla: brillo + sonido y, tras 3,5 s con la barra llena, duplicar / volver a 0 / nada.
// (Port de legado/js/widgets/meta.js.)
// =============================================================================

import { crearEstadoObservable, type Observable } from '../../hooks/useMotor';
import { sonar } from '../../nucleo/sonido';
import type { EventoLive } from '../../tipos/eventos';
import type { ConfigMeta, TipoMeta } from './config';

// Qué cuenta cada tipo de meta. Para una meta nueva, se agrega una entrada aquí (y su vista en
// src/panel/vistas/metas).
export const TIPOS_META: Record<TipoMeta, { unidad: string; cuenta: (e: EventoLive) => number }> = {
  likes: { unidad: 'Likes', cuenta: (e) => (e.tipo === 'like' ? e.cantidad : 0) },
  follows: { unidad: 'Seguidores', cuenta: (e) => (e.tipo === 'follow' ? 1 : 0) },
  shares: { unidad: 'Compartidos', cuenta: (e) => (e.tipo === 'share' ? 1 : 0) },
  // Ojo: TikTok no siempre manda el precio del regalo; sin precio, el regalo suma 0.
  monedas: { unidad: 'Monedas', cuenta: (e) => (e.tipo === 'regalo' ? e.diamantes * e.cantidad : 0) },
};

export const PAUSA_CELEBRACION_MS = 3500; // tiempo con la barra llena antes de duplicar/reiniciar

export interface EstadoMeta {
  tipo: TipoMeta;
  titulo: string;
  /** El vigente (puede haberse duplicado durante el LIVE). */
  objetivo: number;
  actual: number;
  /** Cuántas veces se alcanzó (reinicia la animación de brillo). */
  celebraciones: number;
}

export interface MotorMeta extends Observable<EstadoMeta> {
  aplicarConfig(cfg: ConfigMeta): void;
  alEvento(evento: EventoLive): void;
}

const esTipo = (t: unknown): t is TipoMeta => typeof t === 'string' && Object.hasOwn(TIPOS_META, t);

export function crearMotorMeta(): MotorMeta {
  const estado = crearEstadoObservable<EstadoMeta>({ tipo: 'likes', titulo: 'Meta', objetivo: 100, actual: 0, celebraciones: 0 });
  let alAlcanzar = 'nada';
  let sonido = true;
  let objetivoConfigurado = 100; // el que puso la persona

  return {
    obtener: estado.obtener,
    suscribir: estado.suscribir,

    /** Aplica una configuración. Puede llegar en cualquier momento (cambios en vivo). */
    aplicarConfig(cfg) {
      const nuevoTipo: TipoMeta = esTipo(cfg.t) ? cfg.t : 'likes';
      alAlcanzar = cfg.al || 'nada';
      sonido = cfg.s !== 0;
      // Color propio de la meta; sin él, la barra usa el acento del estilo (meta.css).
      if (/^#[0-9a-f]{6}$/i.test(String(cfg.col))) document.documentElement.style.setProperty('--color', String(cfg.col));
      else document.documentElement.style.removeProperty('--color');

      // Si la persona cambió la meta, manda la suya; si no, se respeta la que se duplicó en el LIVE.
      const nuevoObjetivo = Math.max(1, Number(cfg.o) || 100);
      const cambioObjetivo = nuevoObjetivo !== objetivoConfigurado;
      objetivoConfigurado = nuevoObjetivo;
      estado.fijar((e) => ({
        ...e,
        actual: nuevoTipo !== e.tipo ? 0 : e.actual,
        tipo: nuevoTipo,
        titulo: String(cfg.ti || 'Meta'),
        objetivo: cambioObjetivo ? nuevoObjetivo : e.objetivo,
      }));
    },

    alEvento(evento) {
      const e = estado.obtener();
      const suma = TIPOS_META[e.tipo].cuenta(evento);
      if (!suma) return;

      const antes = e.actual;
      const actual = antes + suma;
      const alcanzada = antes < e.objetivo && actual >= e.objetivo;
      estado.fijar({ ...e, actual, celebraciones: alcanzada ? e.celebraciones + 1 : e.celebraciones });

      if (alcanzada) {
        if (sonido) sonar({ frecuencia: 660, duracion: 0.6 });
        // Se deja ver la barra llena un momento antes de aplicar la acción.
        setTimeout(() => {
          estado.fijar((x) => ({
            ...x,
            objetivo: alAlcanzar === 'duplicar' ? x.objetivo * 2 : x.objetivo,
            actual: alAlcanzar === 'reiniciar' ? 0 : x.actual,
          }));
        }, PAUSA_CELEBRACION_MS);
      }
    },
  };
}
