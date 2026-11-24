// =============================================================================
// widgets/horafeliz/motor.ts — Reglas del widget "Hora feliz y racha" (sin React)
//
// Dos cosas en una placa:
//   - Hora feliz: mientras dure (`hf.h`), se anuncia «¡Hora feliz! Regalos ×2» con su cuenta
//     regresiva. El multiplicador lo aplica cada juego (src/nucleo/conteo.ts); aquí solo se ve.
//   - Racha de regalos: cuenta los regalos que llegan seguidos (un combo de 10 rosas son 10). Si
//     pasan más de `rs` segundos sin ninguno, la racha termina: se muestra «¡Racha de N!» unos
//     segundos y queda como la mejor del LIVE si la supera. Aparece desde `rm` regalos.
// La mejor racha se guarda en este navegador (live-tools:hora-feliz:<w>). En la vista previa,
// nada se guarda.
// =============================================================================

import { crearEstadoObservable, type Observable } from '../../hooks/useMotor';
import type { HoraFeliz } from '../../nucleo/conteo';
import { escribirGuardado, leerGuardado } from '../../nucleo/juego';
import { sonar } from '../../nucleo/sonido';
import type { EventoLive } from '../../tipos/eventos';
import { normalizarConfig, type AjustesWidgetHoraFeliz, type ConfigHoraFeliz } from './config';

export const CLAVE_GUARDADO = 'live-tools:hora-feliz:';
export const FINAL_MS = 4000;   // cuánto se ve «¡Racha de N!» al terminar

export interface EstadoHoraFeliz extends AjustesWidgetHoraFeliz {
  horaFeliz: HoraFeliz | undefined;
  /** Regalos de la racha actual (0 = no hay). */
  racha: number;
  /** Hora del último regalo de la racha (ms). */
  ultimo: number;
  /** La mejor racha del LIVE. */
  mejor: number;
  /** La racha que acaba de terminar y hasta cuándo se muestra. */
  final: { cuenta: number; hasta: number; record: boolean } | null;
  /** Sube con cada regalo de la racha (para el «golpe» del número). */
  golpes: number;
}

export interface MotorHoraFeliz extends Observable<EstadoHoraFeliz> {
  aplicarConfig(cfg: ConfigHoraFeliz): void;
  alEvento(evento: EventoLive): void;
  /** Revisa si la racha ya terminó (se llama cada ~200 ms). */
  revisar(ahora?: number): void;
}

export function crearMotorHoraFeliz(): MotorHoraFeliz {
  const estado = crearEstadoObservable<EstadoHoraFeliz>({
    ...normalizarConfig({}), horaFeliz: undefined, racha: 0, ultimo: 0, mejor: 0, final: null, golpes: 0,
  });
  let clave = '';
  let cargado = false;

  function aplicarConfig(cfg: ConfigHoraFeliz): void {
    clave = `${CLAVE_GUARDADO}${cfg.w || 'url'}`;
    let mejor = estado.obtener().mejor;
    if (!cargado) {
      cargado = true;
      mejor = Math.max(mejor, Number(leerGuardado<{ m: number }>(clave)?.m) || 0);
    }
    estado.fijar((e) => ({ ...e, ...normalizarConfig(cfg), horaFeliz: cfg.hf, mejor }));
  }

  function revisar(ahora: number = Date.now()): void {
    const e = estado.obtener();
    if (e.racha && ahora - e.ultimo > e.segundosRacha * 1000) {
      // Terminó la racha: se anuncia solo si llegó a verse (desde el mínimo).
      const record = e.racha >= e.minimoRacha && e.racha > e.mejor;
      const mejor = Math.max(e.mejor, e.racha);
      if (mejor !== e.mejor) escribirGuardado(clave, { m: mejor });
      estado.fijar({
        ...e, racha: 0, mejor,
        final: e.racha >= e.minimoRacha ? { cuenta: e.racha, hasta: ahora + FINAL_MS, record } : null,
      });
      if (record && e.sonido) sonar({ frecuencia: 784, duracion: 0.6, subida: 1.5 });
      return;
    }
    if (e.final && ahora > e.final.hasta) estado.fijar({ ...e, final: null });
  }

  function alEvento(evento: EventoLive): void {
    if (evento.tipo !== 'regalo') return;
    const ahora = Date.now();
    revisar(ahora);
    const e = estado.obtener();
    if (!e.conRacha) return;
    const antes = e.racha;
    const racha = antes + Math.max(1, Number(evento.cantidad) || 1);
    estado.fijar({ ...e, racha, ultimo: ahora, final: null, golpes: e.golpes + 1 });
    // Un tono que sube cada 10 regalos de racha.
    if (e.sonido && Math.floor(racha / 10) > Math.floor(antes / 10) && racha >= e.minimoRacha) {
      sonar({ frecuencia: 523 + Math.min(12, Math.floor(racha / 10)) * 40, duracion: 0.18, subida: 1.2 });
    }
  }

  return { obtener: estado.obtener, suscribir: estado.suscribir, aplicarConfig, alEvento, revisar };
}
