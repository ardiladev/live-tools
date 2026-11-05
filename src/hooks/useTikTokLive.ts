// =============================================================================
// hooks/useTikTokLive.ts — Conexión con el LIVE (Euler Stream) dentro de un componente
//
// Envuelve el servicio conectarTikTok (src/nucleo/euler.ts): abre la conexión cuando hay
// usuario y clave, la cierra al desmontar y se reconecta si cambian. Los reintentos según el
// código de cierre (4404 → 1 min, 4401 → se rinde, 4555 → 2 s…) los decide el servicio.
//
//   const conexion = useTikTokLive({ usuario, clave, activo, alEvento });
//   conexion.ok / conexion.mensaje / conexion.final
// =============================================================================

import { useEffect, useRef, useState } from 'react';
import { conectarTikTok, limpiarUsuario } from '../nucleo/euler';
import type { EventoLive } from '../tipos/eventos';

export interface EstadoConexion {
  /** Conectado a la sala. */
  ok: boolean;
  /** Texto para la persona ("Conectado al LIVE de @…", "@… no está en vivo…"). '' = todavía nada. */
  mensaje: string;
  /** Se rindió (clave inválida, usuario inválido…): no va a reintentar. */
  final: boolean;
}

export interface OpcionesTikTokLive {
  usuario: string;
  clave: string;
  /** false = no conectar (modo prueba, faltan datos…). */
  activo?: boolean;
  alEvento: (evento: EventoLive) => void;
}

export const SIN_CONEXION: EstadoConexion = { ok: false, mensaje: '', final: false };

export function useTikTokLive({ usuario, clave, activo = true, alEvento }: OpcionesTikTokLive): EstadoConexion {
  const manejador = useRef(alEvento);
  manejador.current = alEvento;
  const [estado, setEstado] = useState<EstadoConexion>(SIN_CONEXION);
  const usuarioLimpio = limpiarUsuario(usuario);

  useEffect(() => {
    if (!activo || !usuarioLimpio || !clave) return undefined;
    const conexion = conectarTikTok({
      usuario: usuarioLimpio,
      clave,
      alEvento: (evento) => manejador.current(evento),
      alEstado: (ok, mensaje, final = false) => setEstado({ ok, mensaje, final }),
    });
    return () => conexion.cerrar();
  }, [usuarioLimpio, clave, activo]);

  return estado;
}
