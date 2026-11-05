// =============================================================================
// panel/estado/sincronizar.ts — Cambios en vivo: sube a Supabase la configuración de cada widget
//
// Cada vista de widget se registra aquí con su forma de armar la configuración (función pura
// del estado del panel). Cada vez que el panel cambia algo (almacen.ts), se recalcula la
// configuración de los widgets y, si cambió, se sube a Supabase 0,6 s después de la última
// tecla; el widget abierto en OBS la recibe al instante (src/hooks/useConfigEnVivo.ts).
// Las ÓRDENES de juego (iniciar/pausar/reiniciar el reloj, reiniciar la batalla, abrir la
// bóveda…) llaman subir(id): se suben YA, sin la espera.
// Funciona aunque la vista del widget no esté abierta: por ejemplo, cuando un regalo cambia
// de código y la ruleta se actualiza sola.
//
// Solo se sincronizan los widgets que ya tienen identificador (se crea al mostrar su URL).
// Sin Supabase configurado, solo arma la configuración (con el estilo) para la URL.
// El estilo visual de cada widget se agrega aquí con la clave `est`; al subir se agrega
// también `u`, el usuario de TikTok de Ajustes → Conexión (la API key nunca se sube).
// (Port de legado/js/panel/sincronizar.js.) Secciones: 1. Registro · 2. Subida · 3. Estado · 4. Arranque
// =============================================================================

import { useSyncExternalStore } from 'react';
import { guardarConfigNube, nubeActiva } from '../../nucleo/nube';
import type { EstadoPanel } from '../../tipos/panel';
import type { ConfigBase, ConfigWidget } from '../../tipos/widgets';
import {
  asegurarIdNube, asegurarSecreto, obtener, temaDe, tieneIdNube, usarAlmacen,
} from './almacen';

export const RETRASO_SUBIDA_MS = 600;      // no subir en cada tecla
export const REINTENTO_INICIAL_MS = 5000;  // si Supabase falla, se reintenta solo; la espera se duplica…
export const REINTENTO_MAXIMO_MS = 60000;  // …hasta 1 min

export const TEXTO_OK = 'Cambios en vivo: el widget en OBS ya tiene esta configuración.';

export type TipoEstadoNube = 'pendiente' | 'guardando' | 'ok' | 'error';
export interface EstadoNube {
  tipo: TipoEstadoNube;
  mensaje: string;
}

export interface DefinicionWidget<C extends ConfigBase = ConfigBase> {
  /** La configuración que recibe el widget (claves cortas), a partir del estado del panel. PURA. */
  config: (estado: EstadoPanel) => C;
  /** Texto con el problema, o '' si la configuración se puede usar. PURA. */
  validar?: (estado: EstadoPanel) => string;
}

interface Registro {
  config: (estado: EstadoPanel) => ConfigWidget;
  validar: (estado: EstadoPanel) => string;
  ultima: string | null;                       // última configuración subida (JSON)
  estado: EstadoNube;
  temporizador: ReturnType<typeof setTimeout> | undefined;
  reintento: number;                           // espera antes del próximo reintento
  cola: Promise<boolean>;                      // las subidas van de una en una, en orden
}

const widgets = new Map<string, Registro>();
const oyentes = new Set<() => void>();


// -----------------------------------------------------------------------------
// 1. Registro
// -----------------------------------------------------------------------------

/**
 * Registra un widget. Las vistas lo hacen al cargar su módulo (vistas/<x>/config.ts), no al
 * abrirse: así los cambios en vivo funcionan con o sin la vista abierta.
 *   id: el mismo de los ajustes (p. ej. 'ruleta' o 'meta-likes')
 */
export function registrar<C extends ConfigBase>(id: string, { config, validar = () => '' }: DefinicionWidget<C>): void {
  widgets.set(id, {
    config: (estado) => ({ ...(config(estado) as ConfigWidget), est: temaDe(estado, id) }),
    validar,
    ultima: null,
    estado: { tipo: 'pendiente', mensaje: '' },
    temporizador: undefined,
    reintento: REINTENTO_INICIAL_MS,
    cola: Promise.resolve(true),
  });
}

/** ¿Hay un widget registrado con ese id? */
export const registrado = (id: string): boolean => widgets.has(id);

/** La configuración del widget `id` (con su estilo `est`), tal como la recibe el widget. */
export function configDe(id: string, estado: EstadoPanel = obtener()): ConfigWidget {
  const w = widgets.get(id);
  if (!w) throw new Error(`El widget "${id}" no está registrado en sincronizar.`);
  return w.config(estado);
}

/** El problema de la configuración del widget `id`, o ''. */
export function validarDe(id: string, estado: EstadoPanel = obtener()): string {
  return widgets.get(id)?.validar(estado) || '';
}


// -----------------------------------------------------------------------------
// 2. Subida
// -----------------------------------------------------------------------------

async function subirAhora(id: string): Promise<boolean> {
  const w = widgets.get(id);
  if (!w) return false;
  const estado = obtener();
  const problema = w.validar(estado);
  if (problema) {
    cambiarEstado(id, 'error', `Los cambios no llegan a OBS hasta corregir esto: ${problema}`);
    return false;
  }
  const config = { ...w.config(estado), u: estado.conexion.usuario.replace(/^@/, '').trim() };
  const texto = JSON.stringify(config);
  if (texto === w.ultima) {
    if (w.estado.tipo !== 'ok') cambiarEstado(id, 'ok', TEXTO_OK);
    return true;
  }

  cambiarEstado(id, 'guardando', 'Enviando los cambios a OBS…');
  try {
    // _v (hora de guardado) le permite al widget descartar una versión vieja que llegue tarde.
    await guardarConfigNube(asegurarIdNube(id), asegurarSecreto(), { ...config, _v: Date.now() });
    w.ultima = texto;
    w.reintento = REINTENTO_INICIAL_MS;
    cambiarEstado(id, 'ok', TEXTO_OK);
    return true;
  } catch (error) {
    // Reintento automático: una orden del panel (reiniciar, abrir la bóveda, iniciar el reloj)
    // no puede quedarse sin llegar a OBS por un corte de red de unos segundos.
    const espera = w.reintento;
    w.reintento = Math.min(espera * 2, REINTENTO_MAXIMO_MS);
    clearTimeout(w.temporizador);
    w.temporizador = setTimeout(() => { void subir(id); }, espera);
    cambiarEstado(id, 'error', `No se pudo guardar en Supabase (${(error as Error).message}). Reintentando en ${Math.round(espera / 1000)} s…`);
    return false;
  }
}

/** Sube YA (en orden con las subidas anteriores). Devuelve si quedó guardado. Para órdenes de juego. */
export function subir(id: string): Promise<boolean> {
  const w = widgets.get(id);
  if (!w || !nubeActiva()) return Promise.resolve(false);
  clearTimeout(w.temporizador);
  w.cola = w.cola.then(() => subirAhora(id));
  return w.cola;
}

/** Sube dentro de un momento; si llegan más cambios antes, se sube solo el último. */
function programar(id: string): void {
  const w = widgets.get(id);
  if (!w) return;
  clearTimeout(w.temporizador);
  w.temporizador = setTimeout(() => { void subir(id); }, RETRASO_SUBIDA_MS);
}

function programarTodos(): void {
  const estado = obtener();
  for (const id of widgets.keys()) {
    if (tieneIdNube(estado, id)) programar(id);
  }
}


// -----------------------------------------------------------------------------
// 3. Estado (lo muestra la tarjeta de cada widget)
// -----------------------------------------------------------------------------

const SIN_ESTADO: EstadoNube = { tipo: 'pendiente', mensaje: '' };

function cambiarEstado(id: string, tipo: TipoEstadoNube, mensaje: string): void {
  const w = widgets.get(id);
  if (!w) return;
  w.estado = { tipo, mensaje };
  oyentes.forEach((fn) => fn());
}

export const estadoNube = (id: string): EstadoNube => widgets.get(id)?.estado || SIN_ESTADO;

/** Llama `fn` cuando cambia el estado de algún widget. Devuelve la función para dejar de escuchar. */
export function alCambiarEstado(fn: () => void): () => void {
  oyentes.add(fn);
  return () => { oyentes.delete(fn); };
}

/** El estado de los cambios en vivo del widget `id` (se vuelve a pintar cuando cambia). */
export function useEstadoNube(id: string): EstadoNube {
  return useSyncExternalStore(alCambiarEstado, () => estadoNube(id), () => estadoNube(id));
}


// -----------------------------------------------------------------------------
// 4. Arranque (lo llama panel/main.tsx después de cargar el almacén)
// -----------------------------------------------------------------------------

let iniciado = false;

export function iniciar(): void {
  if (iniciado || !nubeActiva()) return;
  iniciado = true;
  usarAlmacen.subscribe(programarTodos);
  programarTodos();
}
