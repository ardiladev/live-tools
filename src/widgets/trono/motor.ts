// =============================================================================
// widgets/trono/motor.ts — Lógica del "Trono": el rey del LIVE
//
// Cada persona tiene una "jugada" abierta que se cierra tras 3 s sin regalos suyos; recién
// entonces se compara con el rey (así se cuenta el combo completo aunque el rastreador lo entregue
// en dos partes). Modo `combo`: vale la jugada; modo `total`: lo acumulado por esa persona en la
// sesión. Hay que SUPERAR al rey (empatar no basta) y llegar a `min`. Mientras una jugada abierta
// ya supera al rey, se ve «Fulano desafía el trono…». Si dos jugadas se cierran casi juntas, hay
// un solo cambio de rey. Rey y totales en live-tools:trono:<w>; cambiar de modo deja el trono libre.
//
// Port línea por línea de legado/js/widgets/trono.js: la transición de cambio de rey (el anterior
// sale y el nuevo entra, con el anterior todavía en pantalla mientras sale) trabaja sobre los
// elementos que pinta Trono.tsx, como el original.
// Secciones: 1. Configuración · 2. Guardado · 3. Pintado · 4. Jugadas y coronación
// =============================================================================

import { animarCifra, escribirGuardado, leerGuardado, type CifraAnimada } from '../../nucleo/juego';
import { sonar } from '../../nucleo/sonido';
import type { EventoLive, EventoRegalo } from '../../tipos/eventos';
import type { ConfigTrono, ModoTrono } from './config';

export const CLAVE_GUARDADO = 'live-tools:trono:';
export const ESPERA_JUGADA_MS = 3000; // silencio tras el que una jugada (combo) se da por terminada
export const SALIDA_MS = 450;         // duración de la salida del rey anterior
export const CONTEO_MS = 600;         // duración de la animación de las monedas

/** Los elementos del widget (los crea Trono.tsx). */
export interface ElementosTrono {
  trono: HTMLElement;
  titulo: HTMLElement;
  nombre: HTMLElement;
  monedas: HTMLElement;
  unidad: HTMLElement;
  linea: HTMLElement;
}

export interface MotorTrono {
  aplicarConfig(cfg: ConfigTrono): void;
  alEvento(evento: EventoLive): void;
  detener(): void;
}

interface Rey {
  usuario: string;
  monedas: number;
}

export function crearMotorTrono(el: ElementosTrono): MotorTrono {
  // ---------------------------------------------------------------------------
  // 1. Configuración
  // ---------------------------------------------------------------------------
  let titulo = 'Áurea VIP';
  let modo: ModoTrono = 'combo';
  let minimo = 1;
  let valorRegalo = 1;
  let sonido = true;

  let ronda: number | null = null;
  let claveGuardado = '';
  let rey: Rey | null = null;                  // o null (trono libre)
  let anterior = '';                           // a quién destronó el rey actual
  let totales: Record<string, number> = {};    // usuario → monedas acumuladas en la sesión (modo total)
  const jugadas = new Map<string, { monedas: number; espera?: ReturnType<typeof setTimeout> }>(); // combos todavía abiertos
  let transicion: ReturnType<typeof setTimeout> | 0 = 0; // salida del rey anterior en curso

  /** Aplica una configuración. Puede llegar en cualquier momento (cambios en vivo, reinicio). */
  function aplicarConfig(cfg: ConfigTrono): void {
    titulo = String(cfg.ti ?? 'Áurea VIP').slice(0, 30);
    const modoNuevo: ModoTrono = cfg.m === 'total' ? 'total' : 'combo';
    minimo = Math.max(1, Number(cfg.min) || 1);
    valorRegalo = Math.max(0, Number(cfg.v) || 1);
    sonido = cfg.s !== 0;
    claveGuardado = `${CLAVE_GUARDADO}${cfg.w || 'url'}`;

    // Ronda nueva ("Reiniciar trono") o cambio de modo: el trono queda libre.
    const nuevaRonda = Number(cfg.ro) || 0;
    if (nuevaRonda !== ronda || (ronda !== null && modoNuevo !== modo)) {
      const primeraVez = ronda === null;
      ronda = nuevaRonda;
      modo = modoNuevo;
      rey = null;
      anterior = '';
      totales = {};
      jugadas.forEach((j) => clearTimeout(j.espera));
      jugadas.clear();
      if (transicion) clearTimeout(transicion);
      transicion = 0;
      el.trono.classList.remove('saliendo', 'entrando');
      if (primeraVez) restaurar();
      else guardar();
    }
    modo = modoNuevo;

    el.titulo.textContent = titulo;
    pintarRey();
  }

  // ---------------------------------------------------------------------------
  // 2. Guardado (para que una recarga de OBS no deje el trono libre)
  // ---------------------------------------------------------------------------
  function restaurar(): void {
    const guardado = leerGuardado<{ ro: number; m: string; rey: { usuario?: unknown; monedas?: unknown } | null; ant: unknown; t: unknown }>(claveGuardado);
    if (guardado?.ro !== ronda || guardado.m !== modo) return; // el trono empieza libre
    rey = guardado.rey?.usuario ? { usuario: String(guardado.rey.usuario), monedas: Number(guardado.rey.monedas) || 0 } : null;
    anterior = String(guardado.ant || '');
    totales = guardado.t && typeof guardado.t === 'object' ? (guardado.t as Record<string, number>) : {};
  }

  function guardar(): void {
    escribirGuardado(claveGuardado, { ro: ronda, m: modo, rey, ant: anterior, t: totales });
  }

  // ---------------------------------------------------------------------------
  // 3. Pintado
  // ---------------------------------------------------------------------------
  const formato = new Intl.NumberFormat('es-CO');
  const cifra: CifraAnimada = { mostrado: 0, animacion: 0 };

  /** El rey actual (o el trono libre), sin transición. */
  function pintarRey(): void {
    el.trono.dataset.estado = rey ? 'ocupado' : 'libre';
    el.nombre.textContent = rey ? rey.usuario : 'Trono libre';
    el.unidad.textContent = rey ? (modo === 'total' ? 'monedas en total' : 'monedas de una vez') : '';
    contar(rey?.monedas || 0, false);
    if (!rey) el.monedas.textContent = `Envía ${formato.format(minimo)}+ monedas para reinar`;
    pintarLinea();
  }

  /** Debajo: quién desafía el trono ahora mismo, o a quién destronó el rey. */
  function pintarLinea(): void {
    const retador = [...jugadas.entries()]
      .map(([usuario, j]) => ({ usuario, monedas: candidato(usuario, j.monedas) }))
      .filter((r) => r.usuario !== rey?.usuario && supera(r.monedas))
      .sort((a, b) => b.monedas - a.monedas)[0];
    el.linea.classList.toggle('reto', Boolean(retador));
    el.linea.textContent = retador ? `${retador.usuario} desafía el trono…` : anterior ? `Destronó a ${anterior}` : '';
  }

  /** Las monedas suben poco a poco hasta `hasta`. */
  function contar(hasta: number, animar = true): void {
    animarCifra(cifra, hasta, { animar, ms: CONTEO_MS, escribir: (valor) => { el.monedas.textContent = formato.format(valor); } });
  }

  /**
   * Nuevo rey: el anterior sube y se desvanece, y el nuevo entra desde abajo. Si ya hay un cambio
   * en curso (dos jugadas que se cierran casi juntas), el último rey se muestra al final de ese mismo
   * cambio: sin doble transición ni doble sonido, y "Destronó a…" nombra al que se veía en pantalla.
   */
  function coronar(usuario: string, monedas: number): void {
    const mismoRey = rey?.usuario === usuario;
    if (!mismoRey && rey && !transicion) anterior = rey.usuario;
    rey = { usuario, monedas };
    guardar();
    if (transicion) return;

    const caja = el.trono;
    if (mismoRey) {
      // El mismo rey sube su marca: solo cuentan las monedas y un brillo.
      contar(monedas);
      caja.classList.remove('brillo');
      void caja.offsetWidth;
      caja.classList.add('brillo');
      pintarLinea();
      return;
    }
    if (sonido) sonar({ frecuencia: 587, duracion: 0.7, subida: 1.5 });
    caja.classList.remove('entrando');
    caja.classList.add('saliendo');
    transicion = setTimeout(() => {
      transicion = 0;
      caja.classList.remove('saliendo');
      cifra.mostrado = 0;
      pintarRey();
      if (rey) contar(rey.monedas);
      void caja.offsetWidth; // reinicia la animación
      caja.classList.add('entrando');
    }, SALIDA_MS);
  }

  // ---------------------------------------------------------------------------
  // 4. Jugadas y coronación
  // ---------------------------------------------------------------------------

  /** Lo que valdría la jugada de `usuario` para el trono según el modo. */
  const candidato = (usuario: string, monedasJugada: number): number =>
    (modo === 'total' ? (totales[usuario] || 0) + monedasJugada : monedasJugada);

  /** ¿Alcanza para reinar? Hay que superar al rey (empatar no basta) y llegar al mínimo. */
  const supera = (monedas: number): boolean => monedas >= minimo && monedas > (rey?.monedas || 0);

  /** Se cerró la jugada de `usuario` (3 s sin regalos suyos): se suma y se compara con el rey. */
  function cerrarJugada(usuario: string): void {
    const jugada = jugadas.get(usuario);
    jugadas.delete(usuario);
    if (!jugada) return;
    const monedas = candidato(usuario, jugada.monedas);
    if (modo === 'total') totales[usuario] = monedas;

    if (supera(monedas) || (rey?.usuario === usuario && monedas > rey.monedas)) coronar(usuario, monedas);
    else {
      guardar();
      pintarLinea();
    }
  }

  function alRegalo(evento: EventoRegalo): void {
    // TikTok no siempre manda el precio: entonces vale lo configurado en el panel.
    const monedas = (Number(evento.diamantes) || valorRegalo) * Math.max(1, Number(evento.cantidad) || 1);
    if (!monedas) return;
    const usuario = String(evento.usuario || 'Alguien').slice(0, 40);

    const jugada = jugadas.get(usuario) || { monedas: 0 };
    clearTimeout(jugada.espera);
    jugada.monedas += monedas;
    jugada.espera = setTimeout(() => cerrarJugada(usuario), ESPERA_JUGADA_MS);
    jugadas.set(usuario, jugada);
    pintarLinea();
  }

  return {
    aplicarConfig,
    alEvento(evento) {
      if (evento.tipo === 'regalo') alRegalo(evento);
    },
    detener() {
      jugadas.forEach((j) => clearTimeout(j.espera));
      if (transicion) clearTimeout(transicion);
      cancelAnimationFrame(cifra.animacion);
    },
  };
}
