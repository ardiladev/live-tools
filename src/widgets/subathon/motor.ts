// =============================================================================
// widgets/subathon/motor.ts — Reglas del "Subathon" y del "Subathon extensible" (sin React)
//
// Reloj hacia atrás al que el público le suma tiempo, hasta un tope:
//   - El panel lleva el RELOJ BASE `t` y `ex`, el total que agregó con «+5 min»; el widget lleva
//     lo que suma el público (y aplica cada «+5 min» nuevo: la diferencia entre `ex` y lo visto).
//   - Tiempo que queda = reloj base + lo sumado, sin pasar nunca de `cap`. El reloj base puede
//     quedar negativo (lo sostiene lo sumado), por eso no se usa leerReloj.
//   - El público suma con el reloj en marcha o en pausa (en la vista previa, siempre); «+5 min»
//     suma siempre (incluso revive un reloj en 0). Likes: (likes / 100) × sl; regalos:
//     (precio × cantidad; sin precio, v) × sd.
//   - Con meta (`mt`, el extensible): hasta juntar esas monedas (con el reloj en marcha o en
//     pausa), ni regalos ni likes suman tiempo; del regalo que la cruza cuenta solo el excedente.
//   - Lo sumado se guarda en live-tools:subathon:<w> como { ro, x, ev, m }.
//   - Bomba de tiempo (`md: 'bomba'`): los regalos RESTAN (monedas × sd) y los likes suman; al
//     llegar a 0 la bomba explota: suena, sale el reto de la ronda y (con `rc`) va a la Cola de
//     retos una sola vez por ronda.
// (Port de legado/js/widgets/subathon.js.)
// Secciones: 1. Estado · 2. Tiempo · 3. Guardado · 4. Suma visible · 5. Meta · 6. Sumar tiempo
// =============================================================================

import { crearEstadoObservable, type Observable } from '../../hooks/useMotor';
import { multiplicador, type HoraFeliz } from '../../nucleo/conteo';
import { castigoDeRonda, unaVezPorRonda } from '../../nucleo/final';
import { escribirGuardado, leerGuardado, mandarReto, prueba } from '../../nucleo/juego';
import { formatoReloj } from '../../nucleo/reloj';
import { sonar } from '../../nucleo/sonido';
import type { EventoLive } from '../../tipos/eventos';
import type { RelojRonda } from '../../tipos/reloj';
import type { ConfigSubathon, FaseSubathon } from './config';

export const CLAVE_GUARDADO = 'live-tools:subathon:';
export const URGENTE_MS = 60000;          // por debajo de 1 minuto, el reloj se pone en color de alerta
export const MIN_SUMA_VISIBLE_MS = 1000;  // sumas menores (unos pocos likes) no muestran "+0:01"
export const ESPERA_SONIDO_MS = 1000;     // como mucho un sonido de suma por segundo


// -----------------------------------------------------------------------------
// 1. Estado
// -----------------------------------------------------------------------------

export interface EstadoSubathon {
  titulo: string;
  reloj: RelojRonda;
  capMs: number;
  /** Monedas de la meta (0 = sin meta). */
  meta: number;
  ronda: number | null;
  /** Tiempo sumado (público + "+5 min" del panel ya aplicados). */
  extraMs: number;
  /** Monedas juntadas para la meta en esta ronda. */
  monedas: number;
  /** El "+1:30" (o "−0:12" en la bomba) a la vista: `clave` cambia para reiniciar su animación. */
  flotante: { texto: string; clave: number; resta?: boolean } | null;
  /** Cuántas sumas (reinicia el pulso dorado). */
  pulsos: number;
  /** Cuántas veces se cumplió la meta (reinicia el destello). */
  metasLogradas: number;
  /** 'bomba' = Bomba de tiempo. */
  modo: 'subathon' | 'bomba';
  /** Retos de la bomba (sale uno al explotar). */
  retos: string[];
  /** Cuántos regalos le quitaron tiempo a la bomba (reinicia las chispas). */
  chispas: number;
}

export interface MotorSubathon extends Observable<EstadoSubathon> {
  aplicarConfig(cfg: ConfigSubathon): void;
  alEvento(evento: EventoLive): void;
  /** El "+" terminó su animación (sale de la página). */
  quitarFlotante(): void;
  /** Sonido del final: se llama cuando cambia la fase. */
  alPintar(fase: FaseSubathon): void;
}


// -----------------------------------------------------------------------------
// 2. Tiempo
// -----------------------------------------------------------------------------

/** Lo que marca el reloj base del panel (puede ser negativo si corre y ya pasó su hora). */
export function baseMs(reloj: RelojRonda, ahora: number = Date.now()): number {
  if (reloj.e === 'corre') return (Number(reloj.fin) || 0) - ahora;
  if (reloj.e === 'pausa') return Number(reloj.r) || 0;
  return Math.max(1, Number(reloj.d) || 3600) * 1000;
}

export const restanteDe = (e: EstadoSubathon, ahora: number = Date.now()): number => baseMs(e.reloj, ahora) + e.extraMs;

/** listo | corre | pausa | fin */
export function faseDe(e: EstadoSubathon, ahora: number = Date.now()): FaseSubathon {
  if (e.reloj.e !== 'corre' && e.reloj.e !== 'pausa') return 'listo';
  if (restanteDe(e, ahora) <= 0) return 'fin';
  return e.reloj.e;
}

/** Siempre con horas: "01:05:09" (un subathon suele durar horas; así el ancho no salta). */
export function formatoLargo(ms: number): string {
  const texto = formatoReloj(ms);
  return texto.split(':').length === 2 ? `00:${texto}` : texto.padStart(8, '0');
}

/** 5 000 ms → "0:05" · 90 000 → "1:30" · 3 900 000 → "1:05:00". */
export function formatoCorto(ms: number): string {
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}


/** El reto de la bomba en esta ronda ('' sin retos): siempre el mismo para la misma ronda. */
export const retoDe = (e: Pick<EstadoSubathon, 'retos' | 'ronda'>): string => e.retos[castigoDeRonda(e.retos.length, e.ronda)] ?? '';

export function crearMotorSubathon(): MotorSubathon {
  const estado = crearEstadoObservable<EstadoSubathon>({
    titulo: '', reloj: { e: 'listo', d: 3600 }, capMs: 8 * 3600000, meta: 0, ronda: null,
    extraMs: 0, monedas: 0, flotante: null, pulsos: 0, metasLogradas: 0, modo: 'subathon', retos: [], chispas: 0,
  });
  let segPorLikes = 5;  // por cada 100 likes
  let segPorMoneda = 10;
  let valorRegalo = 1;
  let sonido = true;
  let claveGuardado = '';
  let widgetId = '';
  let cola = '';         // Cola de retos de la bomba (rc)
  let exVisto = 0;      // cuánto de `ex` (panel) ya se aplicó
  let flotanteMs = 0;   // lo que lleva el "+", o lo que se va juntando hasta llegar a 1 s
  let siguienteClave = 1;
  let ultimoSonido = 0;
  let faseAnterior: FaseSubathon | null = null;

  // ---------------------------------------------------------------------------
  // 3. Guardado (para que una recarga de OBS no borre lo sumado)
  // ---------------------------------------------------------------------------
  const guardar = (e: EstadoSubathon): void => escribirGuardado(claveGuardado, { ro: e.ronda, x: e.extraMs, ev: exVisto, m: e.monedas });

  // ---------------------------------------------------------------------------
  // 4. Suma visible: "+1:30" que sube desde el reloj y el pulso dorado de la píldora.
  //    Las sumas se acumulan mientras se ve el "+" anterior y también mientras lo juntado no
  //    llega a 1 s (cada like suma una fracción de segundo).
  // ---------------------------------------------------------------------------
  function mostrarSuma(e: EstadoSubathon, ms: number, resta = false): EstadoSubathon {
    const visible = e.flotante !== null;
    // El "+" anterior ya terminó, o ahora cambia de signo (la bomba: regalos restan, likes suman).
    if ((!visible && flotanteMs >= MIN_SUMA_VISIBLE_MS) || Boolean(e.flotante?.resta) !== resta) flotanteMs = 0;
    flotanteMs += ms;
    const flotante = flotanteMs >= MIN_SUMA_VISIBLE_MS
      ? { texto: `${resta ? '−' : '+'}${formatoCorto(flotanteMs)}`, clave: siguienteClave++, resta } // clave nueva = reinicia la animación
      : e.flotante;
    return { ...e, flotante, pulsos: e.pulsos + 1 };
  }

  // ---------------------------------------------------------------------------
  // 5. Meta (solo con `mt`: el subathon extensible)
  // ---------------------------------------------------------------------------
  const metaCumplida = (e: EstadoSubathon): boolean => e.monedas >= e.meta;

  /**
   * Anota las monedas de un regalo en la meta y devuelve [estado, monedas que suman tiempo]:
   * todas si ya se cumplió (o no hay meta), solo lo que pasa de la meta si este regalo la cruza,
   * 0 si aún falta.
   */
  function monedasQueSuman(e: EstadoSubathon, cantidad: number): [EstadoSubathon, number] {
    if (!e.meta || metaCumplida(e)) return [e, cantidad];
    const anotado = { ...e, monedas: e.monedas + cantidad };
    guardar(anotado);
    if (!metaCumplida(anotado)) return [anotado, 0];
    // ¡Se cruzó la meta! Celebración: la píldora brilla y suena un acorde.
    if (sonido) [660, 880, 1320].forEach((f, i) => setTimeout(() => sonar({ frecuencia: f, duracion: 0.35, volumen: 0.1 }), i * 140));
    return [{ ...anotado, metasLogradas: anotado.metasLogradas + 1 }, anotado.monedas - anotado.meta];
  }

  // ---------------------------------------------------------------------------
  // 6. Sumar tiempo
  // ---------------------------------------------------------------------------

  /** ¿Cuenta ahora lo que manda el público? Con el reloj en marcha o en pausa (o en la vista previa). */
  const publicoCuenta = (e: EstadoSubathon): boolean => {
    const f = faseDe(e);
    return prueba || f === 'corre' || f === 'pausa';
  };

  /**
   * Suma `ms` sin pasar del tope. El público solo suma con el reloj iniciado y sin terminar; el
   * panel ("+5 min") suma siempre. Devuelve [estado, lo que de verdad se sumó].
   */
  function sumar(e: EstadoSubathon, ms: number, { delPanel = false } = {}): [EstadoSubathon, number] {
    if (!delPanel && !publicoCuenta(e)) return [e, 0];
    const ahora = restanteDe(e);
    const nuevo = Math.min(e.capMs, Math.max(0, ahora) + ms);
    if (nuevo <= ahora) return [e, 0]; // ya está en el tope
    let sumado = { ...e, extraMs: e.extraMs + (nuevo - ahora) }; // si estaba por debajo de 0, esto también lo compensa
    guardar(sumado);
    sumado = mostrarSuma(sumado, nuevo - Math.max(0, ahora));
    return [sumado, nuevo - ahora];
  }

  /** Bomba: quita `ms` (sin bajar de 0: en 0, explota). Devuelve [estado, lo que de verdad se quitó]. */
  function restar(e: EstadoSubathon, ms: number): [EstadoSubathon, number] {
    if (!publicoCuenta(e)) return [e, 0];
    const quitado = Math.min(ms, Math.max(0, restanteDe(e)));
    if (quitado <= 0) return [e, 0];
    let restado = { ...e, extraMs: e.extraMs - quitado, chispas: e.chispas + 1 };
    guardar(restado);
    restado = mostrarSuma(restado, quitado, true);
    return [restado, quitado];
  }

  let horaFeliz: HoraFeliz | undefined; // la Hora feliz que manda el panel (cfg.hf)

  /** Aplica una configuración. Puede llegar en cualquier momento (cambios en vivo, reloj, +5 min). */
  function aplicarConfig(cfg: ConfigSubathon): void {
    horaFeliz = cfg.hf;
    segPorLikes = Math.max(0, Number(cfg.sl ?? 5));
    segPorMoneda = Math.max(0, Number(cfg.sd ?? 10));
    valorRegalo = Math.max(0, Number(cfg.v) || 1);
    sonido = cfg.s !== 0;
    claveGuardado = `${CLAVE_GUARDADO}${cfg.w || 'url'}`;
    widgetId = String(cfg.w || '');
    cola = String(cfg.rc || '');
    let e: EstadoSubathon = {
      ...estado.obtener(),
      titulo: String(cfg.ti || '').slice(0, 30),
      reloj: cfg.t && typeof cfg.t === 'object' ? cfg.t : { e: 'listo', d: 3600 },
      // La bomba puede ser corta (desde 10 s); el subathon, mínimo 1 minuto como siempre.
      capMs: Math.max(cfg.md === 'bomba' ? 10 : 60, Number(cfg.cap) || 8 * 3600) * 1000,
      meta: Math.max(0, Math.round(Number(cfg.mt) || 0)),
      modo: cfg.md === 'bomba' ? 'bomba' : 'subathon',
      retos: (Array.isArray(cfg.rt) ? cfg.rt : []).map((t) => String(t).trim().slice(0, 80)).filter(Boolean).slice(0, 12),
    };

    // Ronda nueva (el panel pulsó "Reiniciar"): se borra todo lo sumado.
    const nuevaRonda = Number(cfg.ro) || 0;
    if (nuevaRonda !== e.ronda) {
      e = { ...e, ronda: nuevaRonda, extraMs: 0, monedas: 0 };
      exVisto = 0;
      const guardado = leerGuardado<{ ro: number; x: unknown; ev: unknown; m: unknown }>(claveGuardado);
      if (guardado?.ro === nuevaRonda) {
        e = { ...e, extraMs: Number(guardado.x) || 0, monedas: Math.max(0, Number(guardado.m) || 0) };
        exVisto = Math.max(0, Number(guardado.ev) || 0);
      }
    }

    // "+5 min" del panel que todavía no se habían aplicado.
    const ex = Math.max(0, Number(cfg.ex) || 0);
    if (ex > exVisto) [e] = sumar(e, ex - exVisto, { delPanel: true });
    exVisto = ex;
    guardar(e);
    estado.fijar(e);
  }

  /**
   * Segundos que suma un evento: likes / 100 × sl, o monedas × sd. Con meta, antes de cumplirla
   * los likes no suman y los regalos solo llenan la meta.
   */
  function segundosDe(e: EstadoSubathon, evento: EventoLive): [EstadoSubathon, number] {
    if (e.modo === 'bomba') {
      // Bomba: los likes la enfrían (suman) y los regalos la aceleran (restan).
      if (evento.tipo === 'like') return [e, (Math.max(0, Number(evento.cantidad) || 0) / 100) * segPorLikes];
      if (evento.tipo !== 'regalo') return [e, 0];
      const valor = (Number(evento.diamantes) || valorRegalo) * Math.max(1, Number(evento.cantidad) || 1) * multiplicador(horaFeliz);
      return [e, -valor * segPorMoneda];
    }
    if (evento.tipo === 'like') {
      if (e.meta && !metaCumplida(e)) return [e, 0];
      return [e, (Math.max(0, Number(evento.cantidad) || 0) / 100) * segPorLikes];
    }
    if (evento.tipo === 'regalo') {
      // TikTok no siempre manda el precio: entonces vale lo configurado en el panel.
      const valor = (Number(evento.diamantes) || valorRegalo) * Math.max(1, Number(evento.cantidad) || 1) * multiplicador(horaFeliz); // Hora feliz: x veces
      const [anotado, monedas] = monedasQueSuman(e, valor);
      return [anotado, monedas * segPorMoneda];
    }
    return [e, 0];
  }

  function alEvento(evento: EventoLive): void {
    let e = estado.obtener();
    // Antes de iniciar o después de terminar no cuenta nada (ni para la meta).
    if (!publicoCuenta(e)) return;
    let segundos: number;
    [e, segundos] = segundosDe(e, evento);
    if (!segundos) {
      estado.fijar(e);
      return;
    }
    let sumado: number;
    [e, sumado] = segundos < 0 ? restar(e, -segundos * 1000) : sumar(e, segundos * 1000);
    estado.fijar(e);
    if (sonido && evento.tipo === 'regalo' && sumado > 0 && Date.now() - ultimoSonido > ESPERA_SONIDO_MS) {
      ultimoSonido = Date.now();
      // En la bomba, un chisporroteo grave; en el subathon, la campanita de siempre.
      if (e.modo === 'bomba') sonar({ frecuencia: 220, duracion: 0.18, volumen: 0.09, onda: 'sawtooth', subida: 1.6 });
      else sonar({ frecuencia: 880, duracion: 0.15, volumen: 0.08 });
    }
  }

  /** ¡La bomba explotó! (se llama una vez, al verla pasar a 'fin'): estruendo y reto a la cola. */
  function explotar(e: EstadoSubathon): void {
    if (sonido) {
      sonar({ frecuencia: 90, duracion: 1.4, volumen: 0.22, onda: 'sawtooth', subida: 0.4 });
      sonar({ frecuencia: 160, duracion: 0.6, volumen: 0.12, onda: 'square', subida: 0.5 });
    }
    const reto = retoDe(e);
    if (cola && reto) unaVezPorRonda('bomba', widgetId, Number(e.ronda) || 0, () => { void mandarReto(cola, { texto: reto, usuario: '', origen: 'Bomba de tiempo' }); });
  }

  return {
    obtener: estado.obtener,
    suscribir: estado.suscribir,
    aplicarConfig,
    alEvento,
    quitarFlotante() {
      estado.fijar((e) => ({ ...e, flotante: null }));
    },
    alPintar(fase) {
      const e = estado.obtener();
      if (e.modo === 'bomba') {
        // Explota al llegar a 0 con la mecha encendida (en marcha o en pausa); al recargar OBS ya explotada, no.
        if (fase === 'fin' && (faseAnterior === 'corre' || faseAnterior === 'pausa')) explotar(e);
      } else if (sonido && fase === 'fin' && faseAnterior === 'corre') sonar({ frecuencia: 440, duracion: 1, subida: 0.5 });
      faseAnterior = fase;
    },
  };
}
