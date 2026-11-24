// =============================================================================
// widgets/boveda/motor.ts — Reglas de la "Bóveda dorada" (sin React)
//
// Caja sorpresa: los regalos (precio × cantidad; sin precio, `v`) llenan una barra hacia una meta
// de monedas; al llegar, el candado se abre y aparece el texto secreto. El progreso y si está
// abierta se guardan en live-tools:boveda:<w> como { ro, m, a }. Órdenes del panel: `ro` nueva =
// cerrar y volver a 0; `ab` = 1 = abrir aunque no se llegue a la meta.
// Mapa de aventura (`md: 'mapa'`): las mismas monedas mueven una ficha por un camino de casillas
// (una cada `pc` monedas); la meta es llegar al tesoro, después de la última casilla. Al caer en
// una casilla, `llegada` la muestra unos segundos y, con `rc`, los retos y trampas van a la Cola
// de retos (una vez por casilla y ronda).
// (Port de legado/js/widgets/boveda.js.)
// =============================================================================

import { crearEstadoObservable, type Observable } from '../../hooks/useMotor';
import { multiplicador, type HoraFeliz } from '../../nucleo/conteo';
import { unaVezPorRonda } from '../../nucleo/final';
import { escribirGuardado, leerGuardado, mandarReto } from '../../nucleo/juego';
import { sonar } from '../../nucleo/sonido';
import type { EventoLive, EventoRegalo } from '../../tipos/eventos';
import { normalizarCasillas, type Casilla, type ConfigBoveda } from './config';

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
  /** 'mapa' = Mapa de aventura. */
  modo: 'boveda' | 'mapa';
  casillas: Casilla[];
  /** Monedas por casilla (mapa). */
  porCasilla: number;
  /** La casilla en la que acaba de caer la ficha (1 … casillas) o null; `clave` reinicia el cartel. */
  llegada: { casilla: number; clave: number } | null;
}

/** En qué casilla va la ficha: 0 = salida, 1 … n = casillas, n + 1 = tesoro. */
export const casillaDe = (e: Pick<EstadoBoveda, 'monedas' | 'porCasilla' | 'casillas' | 'abierta'>): number =>
  (e.abierta ? e.casillas.length + 1 : Math.min(e.casillas.length + 1, Math.floor(e.monedas / Math.max(1, e.porCasilla))));

export interface MotorBoveda extends Observable<EstadoBoveda> {
  aplicarConfig(cfg: ConfigBoveda): void;
  alEvento(evento: EventoLive): void;
  /** El cartel de la casilla ya se mostró. */
  quitarLlegada(clave: number): void;
}

export function crearMotorBoveda(): MotorBoveda {
  const estado = crearEstadoObservable<EstadoBoveda>({
    titulo: '', pista: '', secreto: '', meta: 1000, ronda: null, monedas: 0, abierta: false,
    abriendo: false, animarCifras: false, golpes: 0, modo: 'boveda', casillas: [], porCasilla: 100, llegada: null,
  });
  let siguienteLlegada = 1;
  let cola = '';
  let widgetId = '';
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

  let horaFeliz: HoraFeliz | undefined; // la Hora feliz que manda el panel (cfg.hf)

  /** Aplica una configuración. Puede llegar en cualquier momento (cambios en vivo, órdenes del panel). */
  function aplicarConfig(cfg: ConfigBoveda): void {
    horaFeliz = cfg.hf;
    valorRegalo = Math.max(0, Number(cfg.v) || 1);
    sonido = cfg.s !== 0;
    claveGuardado = `${CLAVE_GUARDADO}${cfg.w || 'url'}`;
    cola = String(cfg.rc || '');
    widgetId = String(cfg.w || '');
    const mapa = cfg.md === 'mapa';
    const casillas = mapa ? normalizarCasillas(cfg.cs) : [];
    const porCasilla = Math.max(1, Math.round(Number(cfg.pc) || 100));
    let e: EstadoBoveda = {
      ...estado.obtener(),
      titulo: String(cfg.ti ?? 'Bóveda dorada').slice(0, 40),
      pista: String(cfg.pi ?? 'Premio secreto').slice(0, 60),
      secreto: String(cfg.sec || '').slice(0, 80),
      // En el mapa, la meta es llegar al tesoro: una casilla más que las del camino.
      meta: mapa ? (casillas.length + 1) * porCasilla : Math.max(1, Math.round(Number(cfg.o) || 1000)),
      animarCifras: false,
      modo: mapa ? 'mapa' : 'boveda',
      casillas,
      porCasilla,
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
    const suma = (Number(evento.diamantes) || valorRegalo) * Math.max(1, Number(evento.cantidad) || 1) * multiplicador(horaFeliz); // Hora feliz: x veces
    if (!suma) return;
    const antes = casillaDe(e);
    e = { ...e, monedas: e.monedas + suma, animarCifras: true, golpes: e.golpes + 1 };
    guardar(e);
    // Mapa: ¿cayó en una casilla nueva del camino?
    const ahora = casillaDe(e);
    if (e.modo === 'mapa' && ahora > antes && ahora <= e.casillas.length) {
      e = { ...e, llegada: { casilla: ahora, clave: siguienteLlegada++ } };
      const c = e.casillas[ahora - 1];
      if (sonido) sonar({ frecuencia: c?.tipo === 't' ? 220 : 660, duracion: 0.35, subida: c?.tipo === 't' ? 0.6 : 1.5 });
      if (c && c.tipo !== 'p' && cola) {
        unaVezPorRonda(`mapa${ahora}`, widgetId, Number(e.ronda) || 0, () => {
          void mandarReto(cola, { texto: `${c.tipo === 't' ? 'Trampa' : 'Reto'}: ${c.texto}`, usuario: evento.usuario || '', origen: 'Mapa de aventura' });
        });
      }
    }
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
    quitarLlegada(clave) {
      estado.fijar((e) => (e.llegada?.clave === clave ? { ...e, llegada: null } : e));
    },
  };
}
