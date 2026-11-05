// =============================================================================
// widgets/destacado/motor.ts — Reglas del "Mensaje VIP destacado" (sin React)
//
// Cuando alguien envía regalos por al menos `um` monedas, se fija en pantalla su último mensaje
// del chat durante `d` segundos; si no ha escrito nada, un agradecimiento con su nombre (`tx`).
// (Port de legado/js/widgets/destacado.js; mismas reglas y mismos tiempos.)
//
//   - Mensajes: se recuerda el último mensaje de cada una de las últimas 300 personas que
//     escribieron (no solo los últimos del chat): en un chat rápido, el mensaje de la persona VIP
//     seguramente ya no estaría entre los últimos.
//   - Regalos: los de una misma persona se juntan hasta 2,5 s sin regalos suyos (el rastreador
//     puede entregar un combo en dos partes); recién entonces se compara con `um`.
//   - Si llega otra persona VIP mientras se muestra un mensaje, espera su turno (máximo 5 en fila);
//     la misma persona otra vez antes de salir: se actualiza en vez de repetirse.
//   - Órdenes del panel (cuentan cuando su valor cambia; al abrir la fuente no se repite la
//     última): lp = quitar el mensaje actual y vaciar la fila · pr = mensaje de prueba.
//
// Lo que se pinta se fija al MOSTRAR (etiqueta, agradecimiento, duración): un cambio en vivo se
// ve con el siguiente mensaje, como en el original.
// =============================================================================

import { crearEstadoObservable, type Observable } from '../../hooks/useMotor';
import { sonar } from '../../nucleo/sonido';
import type { EventoChat, EventoLive, EventoRegalo } from '../../tipos/eventos';
import type { ConfigDestacado } from './config';

export const MAX_PERSONAS = 300;       // de cuántas personas se recuerda el último mensaje
export const ESPERA_REGALOS_MS = 2500; // silencio tras el que se suman los regalos de una persona
export const MAX_EN_FILA = 5;
export const SALIDA_MS = 700;          // duración del desvanecido al salir

const formato = new Intl.NumberFormat('es-CO');

interface Destacado {
  usuario: string;
  monedas: number;
  mensaje: string;
}

/** Lo que muestra la tarjeta (queda en la página al ocultarse, como en el original). */
export interface Pintado {
  inicial: string;
  etiqueta: string;
  monedas: string;
  nombre: string;
  mensaje: string;
  sinMensaje: boolean;
  duracionMs: number;
}

export interface EstadoDestacado {
  pintado: Pintado | null;
  visible: boolean;
  saliendo: boolean;
  /** Sube con cada entrada (reinicia la animación de entrada). */
  entradas: number;
  /** Sube cada vez que se muestra o se renueva (reinicia la barra del tiempo). */
  vueltas: number;
}

export interface MotorDestacado extends Observable<EstadoDestacado> {
  aplicarConfig(cfg: ConfigDestacado): void;
  alEvento(evento: EventoLive): void;
}

export function crearMotorDestacado(): MotorDestacado {
  const estado = crearEstadoObservable<EstadoDestacado>({ pintado: null, visible: false, saliendo: false, entradas: 0, vueltas: 0 });

  // ---------- 1. Configuración ----------
  let umbral = 500;
  let duracionMs = 30000;
  let etiqueta = 'VIP';
  let agradecimiento = '¡Gracias por tu apoyo!';
  let valorRegalo = 1;
  let sonido = true;
  let ordenes: { lp: number; pr: number } | null = null; // vistas por última vez

  function aplicarConfig(cfg: ConfigDestacado): void {
    umbral = Math.max(1, Number(cfg.um) || 500);
    duracionMs = Math.min(300, Math.max(3, Number(cfg.d) || 30)) * 1000;
    etiqueta = String(cfg.ti ?? 'VIP').slice(0, 20);
    agradecimiento = String(cfg.tx || '¡Gracias por tu apoyo!').slice(0, 120);
    valorRegalo = Math.max(0, Number(cfg.v) || 1);
    sonido = cfg.s !== 0;

    // Las órdenes solo cuentan cuando cambian (al abrir la fuente no se repite la última).
    const nuevas = { lp: Number(cfg.lp) || 0, pr: Number(cfg.pr) || 0 };
    if (ordenes) {
      if (nuevas.lp !== ordenes.lp) quitarActual();
      if (nuevas.pr !== ordenes.pr) {
        encolar({ usuario: 'Valentina', monedas: Math.max(umbral, 500), mensaje: 'Este es un mensaje de prueba del panel ✨' });
      }
    }
    ordenes = nuevas;
  }

  // ---------- 2. Chat: el último mensaje de cada persona ----------
  const ultimos = new Map<string, string>(); // usuario → texto (de la más vieja a la más reciente)

  function alChat(evento: EventoChat): void {
    const usuario = String(evento.usuario || '');
    const texto = String(evento.texto || '').trim();
    if (!usuario || !texto) return;
    ultimos.delete(usuario); // reinsertar la deja como la más reciente
    ultimos.set(usuario, texto.slice(0, 200));
    if (ultimos.size > MAX_PERSONAS) ultimos.delete(ultimos.keys().next().value as string);
  }

  // ---------- 3. Regalos: se juntan por persona y se compara con el umbral ----------
  const pendientes = new Map<string, { monedas: number; espera?: ReturnType<typeof setTimeout> }>();

  function alRegalo(evento: EventoRegalo): void {
    // TikTok no siempre manda el precio: entonces vale lo configurado en el panel.
    const monedas = (Number(evento.diamantes) || valorRegalo) * Math.max(1, Number(evento.cantidad) || 1);
    if (!monedas) return;
    const usuario = String(evento.usuario || 'Alguien').slice(0, 40);
    const pendiente = pendientes.get(usuario) || { monedas: 0 };
    clearTimeout(pendiente.espera);
    pendiente.monedas += monedas;
    pendiente.espera = setTimeout(() => {
      pendientes.delete(usuario);
      if (pendiente.monedas >= umbral) encolar({ usuario, monedas: pendiente.monedas, mensaje: ultimos.get(usuario) || '' });
    }, ESPERA_REGALOS_MS);
    pendientes.set(usuario, pendiente);
  }

  // ---------- 4. Fila y pintado ----------
  const fila: Destacado[] = [];
  let actual: Destacado | null = null; // en pantalla
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  let cuentaAtras: ReturnType<typeof setTimeout> | undefined;

  function encolar(destacado: Destacado): void {
    // La misma persona otra vez antes de salir: se actualiza en vez de repetirse.
    if (actual?.usuario === destacado.usuario) {
      actual.monedas += destacado.monedas;
      if (destacado.mensaje) actual.mensaje = destacado.mensaje;
      mostrar(actual, { renovar: true });
      return;
    }
    const enFila = fila.find((x) => x.usuario === destacado.usuario);
    if (enFila) {
      enFila.monedas += destacado.monedas;
      enFila.mensaje = destacado.mensaje || enFila.mensaje;
      return;
    }
    if (fila.length >= MAX_EN_FILA) fila.shift();
    fila.push(destacado);
    if (!actual) siguiente();
  }

  function siguiente(): void {
    const proximo = fila.shift();
    if (proximo) mostrar(proximo);
  }

  /** Pinta y muestra un destacado durante `duracionMs`. Con `renovar`, solo reinicia el tiempo. */
  function mostrar(destacado: Destacado, { renovar = false } = {}): void {
    actual = destacado;
    const pintado: Pintado = {
      inicial: destacado.usuario.charAt(0).toUpperCase(),
      etiqueta,
      monedas: `${formato.format(destacado.monedas)} monedas`,
      nombre: destacado.usuario,
      // Si no ha escrito en el chat: el agradecimiento.
      mensaje: destacado.mensaje || agradecimiento,
      sinMensaje: !destacado.mensaje,
      duracionMs,
    };
    estado.fijar((e) => ({
      ...e,
      pintado,
      // Una entrada nueva quita la salida y vuelve a animar la entrada.
      visible: renovar ? e.visible : true,
      saliendo: renovar ? e.saliendo : false,
      entradas: renovar ? e.entradas : e.entradas + 1,
      vueltas: e.vueltas + 1,
    }));
    if (!renovar && sonido) sonar({ frecuencia: 784, duracion: 0.5, subida: 1.3, volumen: 0.1 });

    clearTimeout(temporizador);
    temporizador = setTimeout(ocultar, duracionMs);
  }

  /** Se desvanece y, si hay alguien en fila, pasa al siguiente. */
  function ocultar(): void {
    clearTimeout(temporizador);
    clearTimeout(cuentaAtras);
    if (!actual) return;
    estado.fijar((e) => ({ ...e, saliendo: true }));
    cuentaAtras = setTimeout(() => {
      estado.fijar((e) => ({ ...e, visible: false, saliendo: false }));
      actual = null;
      siguiente();
    }, SALIDA_MS);
  }

  /** Orden del panel: quita el mensaje actual y vacía la fila. */
  function quitarActual(): void {
    fila.length = 0;
    ocultar();
  }

  return {
    obtener: estado.obtener,
    suscribir: estado.suscribir,
    aplicarConfig,
    alEvento(evento) {
      if (evento.tipo === 'chat') alChat(evento);
      if (evento.tipo === 'regalo') alRegalo(evento);
    },
  };
}
