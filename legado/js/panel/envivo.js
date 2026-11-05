// =============================================================================
// envivo.js — Conexión del PANEL con el LIVE (independiente de la de cada widget en OBS)
//
// Sirve para ver los eventos en tiempo real, contar estadísticas y llenar el catálogo de
// regalos. Vive fuera de las vistas para que no se corte al cambiar de sección.
//
// Secciones: 1. Estado · 2. Registro de eventos · 3. Conexión · 4. Suscripciones
// =============================================================================

import { conectarTikTok } from '../comun.js';
import * as almacen from './almacen.js';

const MAX_EVENTOS = 300; // la lista de eventos no crece sin límite durante un LIVE largo


// -----------------------------------------------------------------------------
// 1. Estado (lo leen las vistas Actividad y Buscador de regalos)
// -----------------------------------------------------------------------------

const contadoresEnCero = () => ({ espectadores: 0, likes: 0, follows: 0, shares: 0, monedas: 0, regalos: 0, chats: 0 });

export const estado = {
  conectado: false,
  mensaje: 'Sin conectar',
  eventos: [],                    // los más recientes primero, con su `hora`
  contadores: contadoresEnCero(),
  regalosVistos: new Map(),       // regalos de ESTA sesión: giftId → { giftId, nombre, imagen, diamantes, veces }
};

let conexion = null;              // lo que devuelve conectarTikTok, o null si no hay conexión activa
let conectadoCon = null;          // { usuario, clave } con los que se abrió `conexion`


// -----------------------------------------------------------------------------
// 2. Registro de eventos
// -----------------------------------------------------------------------------

function registrarRegaloDeSesion(evento) {
  const visto = estado.regalosVistos.get(evento.giftId) || { giftId: evento.giftId, veces: 0 };
  Object.assign(visto, {
    nombre: evento.nombre || visto.nombre || '',
    imagen: evento.imagen || visto.imagen || '',
    diamantes: evento.diamantes || visto.diamantes || 0,
    veces: visto.veces + evento.cantidad,
  });
  estado.regalosVistos.set(evento.giftId, visto);
}

function registrar(evento) {
  const c = estado.contadores;
  switch (evento.tipo) {
    case 'espectadores': c.espectadores = evento.cantidad; break;
    case 'like': c.likes += evento.cantidad; break;
    case 'follow': c.follows += 1; break;
    case 'share': c.shares += 1; break;
    case 'chat': c.chats += 1; break;
    case 'regalo':
      c.regalos += evento.cantidad;
      c.monedas += evento.diamantes * evento.cantidad; // 0 si TikTok no mandó el precio
      registrarRegaloDeSesion(evento);
      almacen.registrarRegalo(evento); // catálogo permanente (Actividad → Buscador de regalos)
      break;
    default:
      break;
  }
  // El número de espectadores llega cada pocos segundos: se cuenta, pero no llena la lista.
  if (evento.tipo !== 'espectadores') {
    estado.eventos.unshift({ ...evento, hora: new Date() });
    if (estado.eventos.length > MAX_EVENTOS) estado.eventos.length = MAX_EVENTOS;
  }
  avisar({ evento });
}

/** Mete un evento como si viniera del LIVE. Solo para pruebas desde la consola. */
export const simular = registrar;

/** Pone en cero los contadores, la lista de eventos y los regalos de la sesión. */
export function reiniciarContadores() {
  estado.contadores = { ...contadoresEnCero(), espectadores: estado.contadores.espectadores };
  estado.eventos.length = 0;
  estado.regalosVistos.clear();
  avisar({ estado: true });
}


// -----------------------------------------------------------------------------
// 3. Conexión
// -----------------------------------------------------------------------------

export const activa = () => conexion !== null;

export function conectar() {
  const { usuario, clave } = almacen.conexion();
  if (!usuario || !clave) {
    Object.assign(estado, { conectado: false, mensaje: 'Falta el usuario o la clave: complétalos en Ajustes → Conexión.' });
    avisar({ estado: true });
    return;
  }
  desconectar();
  conectadoCon = { usuario, clave };
  conexion = conectarTikTok({
    usuario,
    clave,
    alEvento: registrar,
    alEstado(ok, mensaje, final) {
      if (final) conexion = null; // ya no reintenta (clave mala…): el botón vuelve a "Conectar"
      Object.assign(estado, { conectado: ok, mensaje });
      avisar({ estado: true });
    },
  });
}

export function desconectar() {
  if (!conexion) return;
  const anterior = conexion;
  conexion = null;
  anterior.cerrar();
}

// La conexión toma el usuario y la clave al abrirse. Si se cambian en Ajustes → Conexión con
// la conexión activa (o reintentando porque la cuenta no está en vivo), se reconecta con los
// nuevos. Se espera un momento para no abrir una conexión por cada tecla: el plan gratuito
// de Euler limita las solicitudes. Con otra cuenta, los contadores de la sesión vuelven a 0.
const ESPERA_CAMBIO_CUENTA_MS = 1500;
let esperaCuenta = null;

const cuentaCambio = () => {
  const { usuario, clave } = almacen.conexion();
  return conexion !== null && (usuario !== conectadoCon.usuario || clave !== conectadoCon.clave);
};

almacen.alCambiar(() => {
  if (!cuentaCambio()) return;
  clearTimeout(esperaCuenta);
  esperaCuenta = setTimeout(() => {
    if (!cuentaCambio()) return;
    const otraCuenta = almacen.conexion().usuario !== conectadoCon.usuario;
    desconectar();
    if (otraCuenta) reiniciarContadores();
    conectar();
  }, ESPERA_CAMBIO_CUENTA_MS);
});


// -----------------------------------------------------------------------------
// 4. Suscripciones
// -----------------------------------------------------------------------------
// Los oyentes reciben { evento } cuando llega un evento, o { estado: true } cuando cambia
// la conexión o se reinician los contadores.

const oyentes = new Set();

function avisar(cambio) {
  oyentes.forEach((fn) => fn(cambio));
}

/** Suscribe `fn`. Con `senal` (AbortSignal), se cancela sola al cerrar la vista. */
export function alCambiar(fn, senal) {
  oyentes.add(fn);
  senal?.addEventListener('abort', () => oyentes.delete(fn), { once: true });
  return () => oyentes.delete(fn);
}
