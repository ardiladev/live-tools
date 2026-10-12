// Conexión del PANEL con el LIVE (independiente de la de cada widget en OBS).
// Sirve para ver los eventos en tiempo real, contar estadísticas y descubrir ids de regalos.
// Vive fuera de las vistas para que no se corte al cambiar de sección.

import { conectarTikTok } from '../comun.js';
import * as almacen from './almacen.js';

const MAX_EVENTOS = 300;

export const estado = {
  conectado: false,
  mensaje: 'Sin conectar',
  eventos: [],                       // los más recientes primero
  contadores: { espectadores: 0, likes: 0, follows: 0, shares: 0, monedas: 0, regalos: 0, chats: 0 },
  regalosVistos: new Map(),          // giftId → { giftId, nombre, imagen, diamantes, veces }
};

let conexion = null;
const oyentes = new Set();
const avisar = (cambio) => oyentes.forEach((fn) => fn(cambio));

export function alCambiar(fn) {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

function registrar(evento) {
  const c = estado.contadores;
  switch (evento.tipo) {
    case 'espectadores': c.espectadores = evento.cantidad; break;
    case 'like': c.likes += evento.cantidad; break;
    case 'follow': c.follows += 1; break;
    case 'share': c.shares += 1; break;
    case 'chat': c.chats += 1; break;
    case 'regalo': {
      c.regalos += evento.cantidad;
      c.monedas += evento.diamantes * evento.cantidad;
      const visto = estado.regalosVistos.get(evento.giftId) || { giftId: evento.giftId, veces: 0 };
      Object.assign(visto, {
        nombre: evento.nombre || visto.nombre || '',
        imagen: evento.imagen || visto.imagen || '',
        diamantes: evento.diamantes || visto.diamantes || 0,
        veces: visto.veces + evento.cantidad,
      });
      estado.regalosVistos.set(evento.giftId, visto);
      break;
    }
  }
  // El número de espectadores llega cada pocos segundos: se cuenta, pero no llena la lista.
  if (evento.tipo !== 'espectadores') {
    estado.eventos.unshift({ ...evento, hora: new Date() });
    if (estado.eventos.length > MAX_EVENTOS) estado.eventos.length = MAX_EVENTOS;
  }
  avisar({ evento });
}

/** Mete un evento como si viniera del LIVE (para probar la vista sin estar en vivo). */
export const simular = registrar;

export function conectar() {
  const { usuario, clave } = almacen.conexion();
  if (!usuario || !clave) {
    Object.assign(estado, { conectado: false, mensaje: 'Falta el usuario o la clave: complétalos en Ajustes → Conexión.' });
    return avisar({ estado: true });
  }
  desconectar();
  conexion = conectarTikTok({
    usuario,
    clave,
    alEvento: registrar,
    alEstado(ok, mensaje, final) {
      if (final) conexion = null; // ya no reintenta: el botón vuelve a "Conectar"
      Object.assign(estado, { conectado: ok, mensaje });
      avisar({ estado: true });
    },
  });
}

export function desconectar() {
  if (!conexion) return;
  const c = conexion;
  conexion = null;
  c.cerrar();
}

export const activa = () => conexion !== null;

export function reiniciarContadores() {
  for (const k of Object.keys(estado.contadores)) if (k !== 'espectadores') estado.contadores[k] = 0;
  estado.eventos.length = 0;
  avisar({ estado: true });
}
