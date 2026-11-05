// =============================================================================
// panel/estado/envivo.ts — Conexión del PANEL con el LIVE (independiente de la de cada widget)
//
// Sirve para ver los eventos en tiempo real, contar estadísticas y llenar el catálogo de
// regalos. Vive fuera de las vistas (servicio) para que no se corte al cambiar de sección;
// las vistas lo leen con el hook useEnVivo().
// (Port de legado/js/panel/envivo.js.) Secciones: 1. Estado · 2. Registro de eventos
//            3. Conexión · 4. Suscripciones
// =============================================================================

import { useSyncExternalStore } from 'react';
import { useAcompasado } from '../../hooks/useAcompasado';
import { conectarTikTok, type ConexionLive } from '../../nucleo/euler';
import type { EventoLive } from '../../tipos/eventos';
import { obtener, registrarRegalo, usarAlmacen } from './almacen';

const MAX_EVENTOS = 300; // la lista de eventos no crece sin límite durante un LIVE largo
/** Tras cambiar usuario o clave con la conexión activa, cuánto esperar antes de reconectar. */
export const ESPERA_CAMBIO_CUENTA_MS = 1500;


// -----------------------------------------------------------------------------
// 1. Estado (lo leen las vistas Actividad y Buscador de regalos)
// -----------------------------------------------------------------------------

export interface Contadores {
  espectadores: number;
  likes: number;
  follows: number;
  shares: number;
  monedas: number;
  regalos: number;
  chats: number;
}

/** Un regalo de ESTA sesión. */
export interface RegaloVisto {
  giftId: string;
  nombre: string;
  imagen: string;
  diamantes: number;
  veces: number;
}

export type EventoConHora = EventoLive & { hora: Date };

export interface EstadoEnVivo {
  conectado: boolean;
  mensaje: string;
  /** ¿Hay una conexión abierta o reintentando? (el botón dice "Desconectar"). */
  activa: boolean;
  /** Los más recientes primero, con su `hora`. */
  eventos: EventoConHora[];
  contadores: Contadores;
  regalosVistos: Map<string, RegaloVisto>;
}

const contadoresEnCero = (): Contadores => ({ espectadores: 0, likes: 0, follows: 0, shares: 0, monedas: 0, regalos: 0, chats: 0 });

let estado: EstadoEnVivo = {
  conectado: false,
  mensaje: 'Sin conectar',
  activa: false,
  eventos: [],
  contadores: contadoresEnCero(),
  regalosVistos: new Map(),
};

let conexion: ConexionLive | null = null;                 // lo que devuelve conectarTikTok, o null
let conectadoCon: { usuario: string; clave: string } | null = null;

/** El estado actual (fuera de React). */
export const estadoEnVivo = (): EstadoEnVivo => estado;

function publicar(cambios: Partial<EstadoEnVivo>, aviso: AvisoEnVivo): void {
  estado = { ...estado, ...cambios, activa: conexion !== null };
  avisar(aviso);
}


// -----------------------------------------------------------------------------
// 2. Registro de eventos
// -----------------------------------------------------------------------------

function registrar(evento: EventoLive): void {
  const c = { ...estado.contadores };
  let regalosVistos = estado.regalosVistos;
  switch (evento.tipo) {
    case 'espectadores': c.espectadores = evento.cantidad; break;
    case 'like': c.likes += evento.cantidad; break;
    case 'follow': c.follows += 1; break;
    case 'share': c.shares += 1; break;
    case 'chat': c.chats += 1; break;
    case 'regalo': {
      c.regalos += evento.cantidad;
      c.monedas += evento.diamantes * evento.cantidad; // 0 si TikTok no mandó el precio
      const visto = regalosVistos.get(evento.giftId) || { giftId: evento.giftId, nombre: '', imagen: '', diamantes: 0, veces: 0 };
      regalosVistos = new Map(regalosVistos).set(evento.giftId, {
        ...visto,
        nombre: evento.nombre || visto.nombre || '',
        imagen: evento.imagen || visto.imagen || '',
        diamantes: evento.diamantes || visto.diamantes || 0,
        veces: visto.veces + evento.cantidad,
      });
      registrarRegalo(evento); // catálogo permanente (Actividad → Buscador de regalos)
      break;
    }
    default:
      break;
  }
  // El número de espectadores llega cada pocos segundos: se cuenta, pero no llena la lista.
  const eventos = evento.tipo === 'espectadores'
    ? estado.eventos
    : [{ ...evento, hora: new Date() }, ...estado.eventos].slice(0, MAX_EVENTOS);
  publicar({ contadores: c, regalosVistos, eventos }, { evento });
}

/** Mete un evento como si viniera del LIVE. Para pruebas (también desde la consola: liveTools.simular). */
export const simular = registrar;

/** Pone en cero los contadores, la lista de eventos y los regalos de la sesión. */
export function reiniciarContadores(): void {
  publicar({
    contadores: { ...contadoresEnCero(), espectadores: estado.contadores.espectadores },
    eventos: [],
    regalosVistos: new Map(),
  }, { estado: true });
}


// -----------------------------------------------------------------------------
// 3. Conexión
// -----------------------------------------------------------------------------

export const activa = (): boolean => conexion !== null;

export function conectar(): void {
  const { usuario, clave } = obtener().conexion;
  if (!usuario || !clave) {
    publicar({ conectado: false, mensaje: 'Falta el usuario o la clave: complétalos en Ajustes → Conexión.' }, { estado: true });
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
      publicar({ conectado: ok, mensaje }, { estado: true });
    },
  });
  publicar({}, { estado: true });
}

export function desconectar(): void {
  if (!conexion) return;
  const anterior = conexion;
  conexion = null;
  anterior.cerrar();
}

// La conexión toma el usuario y la clave al abrirse. Si se cambian en Ajustes → Conexión con
// la conexión activa (o reintentando porque la cuenta no está en vivo), se reconecta con los
// nuevos. Se espera un momento para no abrir una conexión por cada tecla: el plan gratuito
// de Euler limita las solicitudes. Con otra cuenta, los contadores de la sesión vuelven a 0.
let esperaCuenta: ReturnType<typeof setTimeout> | undefined;

const cuentaCambio = (): boolean => {
  const { usuario, clave } = obtener().conexion;
  return conexion !== null && conectadoCon !== null && (usuario !== conectadoCon.usuario || clave !== conectadoCon.clave);
};

usarAlmacen.subscribe(() => {
  if (!cuentaCambio()) return;
  clearTimeout(esperaCuenta);
  esperaCuenta = setTimeout(() => {
    if (!cuentaCambio() || !conectadoCon) return;
    const otraCuenta = obtener().conexion.usuario !== conectadoCon.usuario;
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

export type AvisoEnVivo = { evento: EventoLive } | { estado: true };

const oyentes = new Set<(aviso: AvisoEnVivo) => void>();

function avisar(aviso: AvisoEnVivo): void {
  oyentes.forEach((fn) => fn(aviso));
}

/** Suscribe `fn`. Devuelve la función para dejar de escuchar. */
export function alCambiar(fn: (aviso: AvisoEnVivo) => void): () => void {
  oyentes.add(fn);
  return () => { oyentes.delete(fn); };
}

const suscribirEnVivo = (fn: () => void): (() => void) => alCambiar(fn);

/** El estado de la conexión del panel y lo recibido en esta sesión (se vuelve a pintar con cada cambio). */
export function useEnVivo(): EstadoEnVivo {
  return useSyncExternalStore(suscribirEnVivo, estadoEnVivo, estadoEnVivo);
}

/** Como useEnVivo, pero repinta como mucho una vez cada `intervaloMs` (ver useAcompasado). */
export const useEnVivoAcompasado = (intervaloMs: number): EstadoEnVivo => useAcompasado(alCambiar, estadoEnVivo, intervaloMs);

/** Solo el estado de la conexión: NO se vuelve a pintar con cada evento del LIVE. */
export function useConexionEnVivo(): Pick<EstadoEnVivo, 'conectado' | 'mensaje' | 'activa'> {
  const conectado = useSyncExternalStore(suscribirEnVivo, () => estado.conectado, () => estado.conectado);
  const mensaje = useSyncExternalStore(suscribirEnVivo, () => estado.mensaje, () => estado.mensaje);
  const activaAhora = useSyncExternalStore(suscribirEnVivo, () => estado.activa, () => estado.activa);
  return { conectado, mensaje, activa: activaAhora };
}
