// =============================================================================
// widgets/alertas/motor.ts — Reglas del widget "Alertas de eventos" (sin React)
//
// Las alertas hacen fila y se muestran una tras otra: cada una `d` segundos y medio segundo
// de pausa entre alertas. La fila guarda hasta 30 (una lluvia de follows no puede dejar alertas
// en cola media hora). Un cambio de configuración no borra la fila: las que ya estaban se
// muestran igual. (Port de legado/js/widgets/alertas.js.)
// Secciones: 1. Configuración · 2. Plantillas · 3. Fila
// =============================================================================

import { crearEstadoObservable, type Observable } from '../../hooks/useMotor';
import { esperar, sonar } from '../../nucleo/sonido';
import type { EventoLive } from '../../tipos/eventos';
import type { ConfigAlertas, EventosAlerta } from './config';

export const PAUSA_ENTRE_ALERTAS_MS = 500;
export const MAX_EN_COLA = 30;

/** Lo que se ve en la placa: emoji o imagen del regalo, quién y qué hizo. */
export interface ContenidoAlerta {
  icono: string | { imagen: string };
  quien: string;
  que: string;
}

export interface EstadoAlertas {
  /** La última alerta pintada (queda escrita aunque la placa se esconda). */
  contenido: ContenidoAlerta | null;
  visible: boolean;
}

export interface MotorAlertas extends Observable<EstadoAlertas> {
  aplicarConfig(cfg: ConfigAlertas): void;
  alEvento(evento: EventoLive): void;
}

interface Vista {
  icono: ContenidoAlerta['icono'];
  texto: string;
  pasa: () => boolean;
}

export function crearMotorAlertas(): MotorAlertas {
  const estado = crearEstadoObservable<EstadoAlertas>({ contenido: null, visible: false });

  // ---------------------------------------------------------------------------
  // 1. Configuración
  // ---------------------------------------------------------------------------
  let activos: Required<EventosAlerta> = { regalo: true, follow: true, share: false };
  let minimoMonedas = 0;
  let duracionMs = 5000;
  let sonido = true;

  function aplicarConfig(cfg: ConfigAlertas): void {
    activos = { regalo: true, follow: true, share: false, ...(cfg.ev || {}) } as Required<EventosAlerta>;
    minimoMonedas = Math.max(0, Number(cfg.min) || 0);
    duracionMs = Math.min(15, Math.max(2, Number(cfg.d) || 5)) * 1000;
    sonido = cfg.s !== 0;
  }

  // ---------------------------------------------------------------------------
  // 2. Plantillas: qué muestra cada tipo de evento (para uno nuevo: plantilla + su casilla en la vista)
  // ---------------------------------------------------------------------------
  function plantilla(e: EventoLive): Vista | null {
    switch (e.tipo) {
      case 'regalo':
        return {
          icono: e.imagen ? { imagen: e.imagen } : '🎁',
          texto: `envió ${e.cantidad > 1 ? `${e.cantidad}× ` : ''}${e.nombre || 'un regalo'}`,
          // TikTok no siempre manda el precio: si no se conoce (0), el regalo se alerta igual.
          pasa: () => !e.diamantes || e.diamantes * e.cantidad >= minimoMonedas,
        };
      case 'follow':
        return { icono: '💖', texto: 'te empezó a seguir', pasa: () => true };
      case 'share':
        return { icono: '📣', texto: 'compartió el LIVE', pasa: () => true };
      default:
        return null;
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Fila de alertas
  // ---------------------------------------------------------------------------
  const cola: { evento: EventoLive & { usuario: string }; vista: Vista }[] = [];
  let mostrando = false;

  async function mostrarSiguiente(): Promise<void> {
    if (mostrando) return;
    mostrando = true;
    while (cola.length) {
      const { evento, vista } = cola.shift() as (typeof cola)[number];
      estado.fijar({ contenido: { icono: vista.icono, quien: evento.usuario, que: vista.texto }, visible: true });
      if (sonido) sonar();
      await esperar(duracionMs);
      estado.fijar((e) => ({ ...e, visible: false }));
      await esperar(PAUSA_ENTRE_ALERTAS_MS);
    }
    mostrando = false;
  }

  return {
    obtener: estado.obtener,
    suscribir: estado.suscribir,
    aplicarConfig,
    alEvento(evento) {
      if (evento.tipo !== 'regalo' && evento.tipo !== 'follow' && evento.tipo !== 'share') return;
      if (!activos[evento.tipo]) return;
      const vista = plantilla(evento);
      if (!vista || !vista.pasa()) return;
      if (cola.length >= MAX_EN_COLA) cola.shift();
      cola.push({ evento, vista });
      void mostrarSiguiente();
    },
  };
}
