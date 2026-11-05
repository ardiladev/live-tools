// =============================================================================
// hooks/useWidget.ts — Arranque común de un widget (OBS / TikTok LIVE Studio)
//
// Es el iniciarWidget del código original, como hook. Cada widget lo llama una vez:
//
//   const widget = useWidget({ alConfig: motor.aplicarConfig, alEvento: motor.alEvento });
//   … <PildoraEstado widget={widget} />
//
// Qué hace, en este orden (el mismo de siempre):
//   1. Lee la URL: #c= (usuario, clave y, o bien el identificador `w`, o bien toda la
//      configuración), ?fondo=1 (fondo gris y píldora de estado, vista previa del panel) y
//      ?prueba=1 (no se conecta a TikTok: solo recibe eventos de prueba del panel).
//   2. Antes de pintar: aplica el estilo (`est`) y entrega la configuración inicial a
//      `alConfig`: la de la URL o, con `w`, la última recibida de Supabase (caché en
//      localStorage "live-tools:widget:<w>"), por si Supabase no responde.
//   3. Con `w`: escucha Supabase (useConfigEnVivo). Cada configuración nueva se guarda en la
//      caché y se aplica sin recargar, salvo que sea más vieja (`_v`) que la que ya tiene.
//      El usuario que manda el panel (`u`) gana sobre el de la URL; la clave sale siempre de
//      la URL. Si cambia el usuario, espera 2 s sin cambios y se reconecta con el nuevo.
//   4. Mensajes del panel (postMessage del mismo origen): simular → alEvento;
//      tema → solo el estilo; config → la configuración completa (sin recargar).
//      Si cambia el #c= de la URL, recarga la página (lo más seguro es empezar de cero).
//   5. Se conecta al LIVE con useTikTokLive (salvo en prueba o si faltan usuario o clave) y
//      avisa el estado a la vista previa del panel (avisarPadre).
// `alConfig` debe poder llamarse muchas veces: aplica la configuración nueva sin perder el
// estado del widget. Los eventos de prueba y los reales llegan por el mismo `alEvento`.
// =============================================================================

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { configDanada, leerConfig } from '../nucleo/configUrl';
import { limpiarUsuario } from '../nucleo/euler';
import { avisarPadre } from '../nucleo/mensajes';
import { aplicarTema } from '../nucleo/tema';
import type { EventoLive } from '../tipos/eventos';
import type { TemaEntrada } from '../tipos/tema';
import type { ConfigBase, ConfigWidget } from '../tipos/widgets';
import { useConfigEnVivo } from './useConfigEnVivo';
import { useTikTokLive } from './useTikTokLive';

/** Copia de la última configuración recibida de Supabase, por widget (clave + identificador). */
export const CLAVE_CACHE = 'live-tools:widget:';
/** Tras un cambio de usuario desde el panel, cuánto esperar antes de reconectar. */
export const ESPERA_CAMBIO_USUARIO_MS = 2000;

export const MENSAJES_WIDGET = {
  danada: 'La configuración de la URL está dañada. Cópiala de nuevo desde el panel.',
  prueba: 'Modo prueba: sin conexión a TikTok',
  faltan: 'Falta el usuario de TikTok o la clave de Euler Stream en la URL.',
} as const;

export interface OpcionesWidget<C extends ConfigBase = ConfigWidget> {
  /** Cada configuración: al arrancar y en cada cambio en vivo (o de la vista previa). */
  alConfig: (config: C) => void;
  /** Eventos del LIVE y de prueba. */
  alEvento: (evento: EventoLive) => void;
}

export interface EstadoWidget {
  /** Estado de la conexión (o del modo prueba) para la píldora y la vista previa. */
  ok: boolean;
  mensaje: string;
  /** ?prueba=1: vista previa del panel, sin conexión. */
  prueba: boolean;
  /** ?fondo=1: fondo gris y píldora de estado visible. */
  vistaPrevia: boolean;
}


// -----------------------------------------------------------------------------
// Caché y arranque
// -----------------------------------------------------------------------------

function leerCache(id: string): ConfigWidget | null {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_CACHE + id) || 'null') as ConfigWidget | null;
  } catch {
    return null;
  }
}

function guardarCache(id: string, config: ConfigWidget): void {
  try {
    localStorage.setItem(CLAVE_CACHE + id, JSON.stringify(config));
  } catch {
    // Sin almacenamiento: el widget sigue funcionando, solo que sin copia de respaldo.
  }
}

/** La configuración que llega de Supabase, con el usuario de la URL si no trae uno, y la clave y el id de la URL. */
const combinarConUrl = (config: ConfigWidget, cfgUrl: ConfigWidget): ConfigWidget =>
  ({ ...config, u: config?.u || cfgUrl.u, k: cfgUrl.k, w: cfgUrl.w });

interface Arranque {
  vistaPrevia: boolean;
  prueba: boolean;
  danada: boolean;
  /** Lo que trae el #c= (null si no trae nada o viene dañado). */
  cfgUrl: ConfigWidget | null;
  /** La configuración que se aplica al arrancar (null si la URL viene dañada). */
  inicial: ConfigWidget | null;
  /** `_v` de la configuración inicial (las más viejas que lleguen después se ignoran). */
  version: number;
  usuario: string;
  puedeConectar: boolean;
}

/** Todo lo que se sabe al abrir la página (solo lecturas: URL y caché). */
function prepararArranque(): Arranque {
  const parametros = new URLSearchParams(location.search);
  const leida = leerConfig();
  const danada = configDanada(leida);
  const cfgUrl = danada || !leida ? null : (leida as ConfigWidget);
  let inicial: ConfigWidget | null = null;
  let version = 0;
  if (!danada) {
    if (cfgUrl?.w) {
      const cache = leerCache(String(cfgUrl.w)) || {};
      version = Number(cache._v) || 0;
      inicial = combinarConUrl(cache, cfgUrl);
    } else {
      inicial = cfgUrl || {};
    }
  }
  const prueba = parametros.get('prueba') === '1';
  const usuario = limpiarUsuario(inicial?.u || cfgUrl?.u || '');
  return {
    vistaPrevia: parametros.get('fondo') === '1',
    prueba,
    danada,
    cfgUrl,
    inicial,
    version,
    usuario,
    puedeConectar: !danada && !prueba && Boolean(usuario) && Boolean(cfgUrl?.k),
  };
}


// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useWidget<C extends ConfigBase = ConfigWidget>({ alConfig, alEvento }: OpcionesWidget<C>): EstadoWidget {
  const [arranque] = useState(prepararArranque);
  const manejadores = useRef({ alConfig, alEvento });
  manejadores.current = { alConfig, alEvento };
  const version = useRef(arranque.version);
  const esperaUsuario = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [usuario, setUsuario] = useState(arranque.usuario);

  // Con la conexión abierta, un usuario nuevo espera 2 s (no se reconecta en cada tecla).
  const seguirUsuario = useRef((pedido: string) => {
    if (!arranque.puedeConectar) return;
    clearTimeout(esperaUsuario.current);
    esperaUsuario.current = setTimeout(() => {
      const limpio = limpiarUsuario(pedido);
      if (limpio) setUsuario(limpio);
    }, ESPERA_CAMBIO_USUARIO_MS);
  }).current;

  /** Estilo + configuración del widget + usuario (lo que hacía el alConfig de iniciarWidget). */
  const aplicarConfig = useRef((config: ConfigWidget) => {
    aplicarTema(config.est);
    manejadores.current.alConfig(config as unknown as C);
    if (config.u) seguirUsuario(String(config.u));
  }).current;

  // 2. Configuración inicial, antes de pintar.
  useLayoutEffect(() => {
    if (arranque.vistaPrevia) document.body.classList.add('vista-previa');
    if (arranque.inicial) {
      aplicarTema(arranque.inicial.est);
      manejadores.current.alConfig(arranque.inicial as unknown as C);
    }
  }, [arranque]);

  // 3. Cambios en vivo desde Supabase (solo si la URL trae `w`).
  useConfigEnVivo(arranque.danada ? undefined : arranque.cfgUrl?.w as string | undefined, (config) => {
    const cfgUrl = arranque.cfgUrl;
    if (!cfgUrl?.w) return;
    guardarCache(String(cfgUrl.w), config);
    const v = Number(config?._v) || 0;
    if (v && v <= version.current) return;
    version.current = v;
    aplicarConfig(combinarConUrl(config, cfgUrl));
  });

  // 4. Mensajes del panel y cambios del #c=.
  useEffect(() => {
    const alCambiarHash = (): void => location.reload();
    const alMensaje = (ev: MessageEvent): void => {
      if (ev.origin !== location.origin) return;
      const datos = ev.data as { tipo?: string; evento?: EventoLive; est?: TemaEntrada; config?: ConfigWidget } | null;
      if (datos?.tipo === 'simular' && datos.evento) manejadores.current.alEvento(datos.evento);
      if (datos?.tipo === 'tema' && datos.est) aplicarTema(datos.est);
      if (datos?.tipo === 'config' && datos.config) aplicarConfig(datos.config);
    };
    addEventListener('hashchange', alCambiarHash);
    addEventListener('message', alMensaje);
    return () => {
      removeEventListener('hashchange', alCambiarHash);
      removeEventListener('message', alMensaje);
      clearTimeout(esperaUsuario.current);
    };
  }, [aplicarConfig]);

  // 5. Conexión al LIVE y su estado.
  const conexion = useTikTokLive({
    usuario,
    clave: String(arranque.cfgUrl?.k || ''),
    activo: arranque.puedeConectar,
    alEvento: (evento) => manejadores.current.alEvento(evento),
  });
  const estado = arranque.danada ? { ok: false, mensaje: MENSAJES_WIDGET.danada }
    : arranque.prueba ? { ok: true, mensaje: MENSAJES_WIDGET.prueba }
      : !arranque.puedeConectar ? { ok: false, mensaje: MENSAJES_WIDGET.faltan }
        : conexion;

  useEffect(() => {
    if (!estado.mensaje) return;
    console.log(`[widget] ${estado.mensaje}`);
    avisarPadre({ tipo: 'estado', ok: estado.ok, mensaje: estado.mensaje });
  }, [estado.ok, estado.mensaje]);

  return { ok: estado.ok, mensaje: estado.mensaje, prueba: arranque.prueba, vistaPrevia: arranque.vistaPrevia };
}
