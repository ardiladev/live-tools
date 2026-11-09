// =============================================================================
// widgets/marcador/motor.ts — Reglas del "Marcador" (sin React)
//
// Una versión sencilla de la carrera de regalos: cada integrante tiene asignado un regalo de
// TikTok y, cuando alguien lo envía, su puntaje sube (precio × cantidad). Sin barras ni metas:
// el puntaje solo crece hasta que se reinicia la ronda. Arriba, el reloj de la ronda.
//   - El regalo se asigna por ID; si ninguno coincide, por el nombre que manda TikTok.
//   - Con el tiempo terminado no suma nada (solo los combos que cierran en los 3 s de gracia del
//     final), ni siquiera en la vista previa. Antes de empezar o en pausa los regalos suman, salvo
//     con `sr` = 1 (solo con el reloj en marcha); en la vista previa cuentan aunque haya `sr`.
//   - Puntos guardados en live-tools:marcador:<w> como { ro, p }; vuelven a 0 al cambiar `ro`.
//   - Al terminar el tiempo: clase `final` en <body> (quien va primero queda destacado) y campana.
// (Port de legado/js/widgets/marcador.js.)
// =============================================================================

import { crearEstadoObservable, type Observable } from '../../hooks/useMotor';
import { buscarPorRegalo, enGracia, escribirGuardado, leerGuardado, prueba, relojCuenta } from '../../nucleo/juego';
import { leerReloj } from '../../nucleo/reloj';
import { sonar } from '../../nucleo/sonido';
import type { EventoLive, EventoRegalo } from '../../tipos/eventos';
import type { LecturaReloj, RelojRonda } from '../../tipos/reloj';
import { MAX_INTEGRANTES, normalizarIntegrante, type ConfigMarcador, type IntegranteMarcador } from './config';

export const CLAVE_PUNTOS = 'live-tools:marcador:';

export interface EstadoMarcador {
  titulo: string;
  integrantes: IntegranteMarcador[];
  reloj: RelojRonda;
  soloConReloj: boolean;
  sonido: boolean;
  ronda: number | null;
  puntos: Record<string, number>;
  imagenesAprendidas: Record<string, string>;
  /** false = el último cambio de puntos vino de la configuración (los números saltan). */
  animarPuntos: boolean;
  /** Sube con cada repintado de todas las tarjetas (configuración, imagen aprendida): corta las
   *  cuentas que siguieran a medias, como en el original. */
  pintadas: number;
  /** id → cuántas veces sumó (reinicia la animación "golpe"). */
  golpes: Record<string, number>;
}

export interface MotorMarcador extends Observable<EstadoMarcador> {
  aplicarConfig(cfg: ConfigMarcador): void;
  alEvento(evento: EventoLive): void;
  alPintarReloj(lectura: LecturaReloj): void;
}

export function crearMotorMarcador(): MotorMarcador {
  const estado = crearEstadoObservable<EstadoMarcador>({
    titulo: '', integrantes: [], reloj: { e: 'listo', d: 300 }, soloConReloj: false, sonido: true,
    ronda: null, puntos: {}, imagenesAprendidas: {}, animarPuntos: false, pintadas: 0, golpes: {},
  });
  let claveGuardado = '';
  let estadoAnterior: LecturaReloj['estado'] | null = null;

  function restaurarPuntos(ronda: number): Record<string, number> {
    const guardado = leerGuardado<{ ro: number; p: Record<string, unknown> }>(claveGuardado);
    if (guardado?.ro !== ronda) return {};
    const puntos: Record<string, number> = {};
    for (const [id, valor] of Object.entries(guardado.p || {})) puntos[id] = Math.max(0, Number(valor) || 0);
    return puntos;
  }

  function aplicarConfig(cfg: ConfigMarcador): void {
    claveGuardado = `${CLAVE_PUNTOS}${cfg.w || 'url'}`;
    estado.fijar((e) => {
      const nuevaRonda = Number(cfg.ro) || 0;
      const rondaNueva = nuevaRonda !== e.ronda;
      return {
        ...e,
        integrantes: (Array.isArray(cfg.j) ? cfg.j : []).slice(0, MAX_INTEGRANTES).map(normalizarIntegrante),
        reloj: cfg.t && typeof cfg.t === 'object' ? cfg.t : { e: 'listo', d: 300 },
        soloConReloj: cfg.sr === 1,
        sonido: cfg.s !== 0,
        titulo: String(cfg.ti || ''),
        ronda: rondaNueva ? nuevaRonda : e.ronda,
        puntos: rondaNueva ? restaurarPuntos(nuevaRonda) : e.puntos,
        animarPuntos: false,
        pintadas: e.pintadas + 1,
      };
    });
  }

  /** ¿Cuenta un regalo que llega ahora? Nunca con el tiempo terminado (pasada la gracia). Si no,
   *  siempre; con `sr`, solo con el reloj en marcha (la vista previa no exige `sr`). */
  function cuentaAhora(e: EstadoMarcador, ahora: number = Date.now()): boolean {
    if (leerReloj(e.reloj, ahora).estado === 'fin' && !enGracia(e.reloj, ahora)) return false;
    return prueba || !e.soloConReloj || relojCuenta(e.reloj, ahora);
  }

  function alRegalo(evento: EventoRegalo): void {
    const e = estado.obtener();
    const j = buscarPorRegalo(e.integrantes, evento);
    if (!j || !cuentaAhora(e)) return;

    const imagenesAprendidas = evento.imagen && !j.imagen && !e.imagenesAprendidas[j.id]
      ? { ...e.imagenesAprendidas, [j.id]: evento.imagen }
      : e.imagenesAprendidas;

    // TikTok no siempre manda el precio: entonces vale lo configurado en el panel.
    const suma = (Number(evento.diamantes) || j.valor || 1) * Math.max(1, Number(evento.cantidad) || 1);
    const puntos = { ...e.puntos, [j.id]: (e.puntos[j.id] || 0) + suma };
    escribirGuardado(claveGuardado, { ro: e.ronda, p: puntos });
    estado.fijar({
      ...e, puntos, imagenesAprendidas, animarPuntos: true,
      // Con una imagen nueva, el original repinta todas las tarjetas.
      pintadas: imagenesAprendidas !== e.imagenesAprendidas ? e.pintadas + 1 : e.pintadas,
      golpes: { ...e.golpes, [j.id]: (e.golpes[j.id] || 0) + 1 },
    });
  }

  return {
    obtener: estado.obtener,
    suscribir: estado.suscribir,
    aplicarConfig,
    alEvento(evento) {
      if (evento.tipo === 'regalo') alRegalo(evento);
    },
    alPintarReloj({ estado: estadoReloj }) {
      document.body.classList.toggle('final', estadoReloj === 'fin');
      if (estado.obtener().sonido && estadoReloj === 'fin' && estadoAnterior === 'corre') sonar({ frecuencia: 523, duracion: 0.9, subida: 2 });
      estadoAnterior = estadoReloj;
    },
  };
}
