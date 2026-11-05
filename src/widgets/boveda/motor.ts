// =============================================================================
// widgets/boveda/motor.ts — Reglas de la "Bóveda dorada" (sin React)
//
// Caja sorpresa: los regalos (precio × cantidad; sin precio, `v`) llenan una barra hacia una meta
// de monedas; al llegar, el candado se abre y aparece el texto secreto. El progreso y si está
// abierta se guardan en live-tools:boveda:<w> como { ro, m, a }. Órdenes del panel: `ro` nueva =
// cerrar y volver a 0; `ab` = 1 = abrir aunque no se llegue a la meta.
// (Port de legado/js/widgets/boveda.js.)
// =============================================================================

import { crearEstadoObservable, type Observable } from '../../hooks/useMotor';
import { escribirGuardado, leerGuardado } from '../../nucleo/juego';
import { sonar } from '../../nucleo/sonido';
import type { EventoLive, EventoRegalo } from '../../tipos/eventos';
import type { ConfigBoveda } from './config';

export const CLAVE_GUARDADO = 'live-tools:boveda:';

export interface EstadoBoveda {
  titulo: string;
  pista: string;
  /** El secreto (solo se pinta cuando la bóveda está abierta). */
  secreto: string;
  meta: number;
  ronda: number | null;
  monedas: number;
  abierta: boolean;
  /** La animación de apertura (solo al abrir; un cambio en vivo posterior no la corta). */
  abriendo: boolean;
  /** false = el último cambio de monedas vino de la configuración (las cifras saltan). */
  animarCifras: boolean;
  /** Cuántos regalos (reinicia la animación "golpe"). */
  golpes: number;
}

export interface MotorBoveda extends Observable<EstadoBoveda> {
  aplicarConfig(cfg: ConfigBoveda): void;
  alEvento(evento: EventoLive): void;
}

export function crearMotorBoveda(): MotorBoveda {
  const estado = crearEstadoObservable<EstadoBoveda>({
    titulo: '', pista: '', secreto: '', meta: 1000, ronda: null, monedas: 0, abierta: false,
    abriendo: false, animarCifras: false, golpes: 0,
  });
  let valorRegalo = 1;
  let sonido = true;
  let claveGuardado = '';

  const guardar = (e: EstadoBoveda): void => escribirGuardado(claveGuardado, { ro: e.ronda, m: e.monedas, a: e.abierta ? 1 : 0 });

  /** Abre la bóveda (siempre con animación y, con sonido, dos tonos). */
  function abrir(e: EstadoBoveda): EstadoBoveda {
    const abierta = { ...e, abierta: true, abriendo: true, animarCifras: false };
    guardar(abierta);
    if (sonido) {
      sonar({ frecuencia: 523, duracion: 0.5, subida: 1.5 });
      setTimeout(() => sonar({ frecuencia: 784, duracion: 0.9, subida: 1.5 }), 220);
    }
    return abierta;
  }

  /** Aplica una configuración. Puede llegar en cualquier momento (cambios en vivo, órdenes del panel). */
  function aplicarConfig(cfg: ConfigBoveda): void {
    valorRegalo = Math.max(0, Number(cfg.v) || 1);
    sonido = cfg.s !== 0;
    claveGuardado = `${CLAVE_GUARDADO}${cfg.w || 'url'}`;
    let e: EstadoBoveda = {
      ...estado.obtener(),
      titulo: String(cfg.ti ?? 'Bóveda dorada').slice(0, 40),
      pista: String(cfg.pi ?? 'Premio secreto').slice(0, 60),
      secreto: String(cfg.sec || '').slice(0, 80),
      meta: Math.max(1, Math.round(Number(cfg.o) || 1000)),
      animarCifras: false,
    };
    // Ronda nueva (el panel pulsó "Cerrar y reiniciar"): bóveda cerrada y progreso en 0.
    const nuevaRonda = Number(cfg.ro) || 0;
    if (nuevaRonda !== e.ronda) {
      const guardado = leerGuardado<{ ro: number; m: unknown; a: number }>(claveGuardado);
      const deEstaRonda = guardado?.ro === nuevaRonda;
      e = {
        ...e,
        ronda: nuevaRonda,
        monedas: deEstaRonda ? Math.max(0, Number(guardado.m) || 0) : 0,
        abierta: deEstaRonda ? guardado.a === 1 : false,
      };
    }
    // "Abrir ahora" del panel, o una meta que bajó hasta lo que ya se juntó.
    if (!e.abierta && (cfg.ab === 1 || e.monedas >= e.meta)) e = abrir(e);
    else if (!e.abierta) e = { ...e, abriendo: false };
    estado.fijar(e);
  }

  function alRegalo(evento: EventoRegalo): void {
    let e = estado.obtener();
    if (e.abierta) return;
    // TikTok no siempre manda el precio: entonces vale lo configurado en el panel.
    const suma = (Number(evento.diamantes) || valorRegalo) * Math.max(1, Number(evento.cantidad) || 1);
    if (!suma) return;
    e = { ...e, monedas: e.monedas + suma, animarCifras: true, golpes: e.golpes + 1 };
    guardar(e);
    // Al abrirse, las cifras saltan al valor final (en el original, abrir repinta sin animar).
    if (e.monedas >= e.meta) e = abrir(e);
    estado.fijar(e);
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
