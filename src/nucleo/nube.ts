// =============================================================================
// nucleo/nube.ts — Cambios en vivo con Supabase (lo usan el panel y los widgets)
//
// Sin Supabase, toda la configuración de un widget viaja en su URL (#c=…) y hay que volver
// a copiarla tras cada cambio. Con Supabase, la URL solo lleva usuario, clave e identificador
// del widget (w); la configuración se guarda en Supabase y el widget la recibe al instante.
//
//   Panel  ──guardar_widget(id, secreto, config)──►  Supabase  ──Realtime "widget-<id>"──►  Widget
//
// Cola de retos (sección 5): al revés que la configuración, aquí los widgets SÍ escriben:
//   Ruleta / tragamonedas / cola.html ──agregar_reto──►  Supabase  ──Realtime "retos-<cola>"──►  Cola y panel
//   Panel ──marcar_reto / vaciar_retos (con el secreto)──►  Supabase
//
// La base de datos está descrita en supabase/esquema.sql. Si SUPABASE_URL o SUPABASE_CLAVE
// están vacíos, todo funciona como antes (configuración completa en la URL).
// Los hooks useConfigEnVivo y useRetos (src/hooks/) envuelven las suscripciones de aquí.
// (Port 1:1 de legado/js/nube.js; la librería ahora sale de npm, misma versión 2.117.2.)
// Secciones: 1. Proyecto · 2. Identificadores · 3. Leer y guardar · 4. Escuchar cambios
//            5. Cola de retos
// =============================================================================

import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { ConfigWidget } from '../tipos/widgets';


// -----------------------------------------------------------------------------
// 1. Proyecto de Supabase
// -----------------------------------------------------------------------------
// Están en Supabase → Project Settings → API. La clave es la pública ("publishable" o
// "anon"): está hecha para ir en páginas web; la tabla solo se toca con las funciones
// de esquema.sql. NUNCA pongas aquí la clave secreta ("secret" o "service_role").

export const SUPABASE_URL = 'https://sjiptivsxisnyleyanxk.supabase.co';
export const SUPABASE_CLAVE = 'sb_publishable_toPcSh0sxSlOwfF_CktJ3w_PKnYIoiQ';

/** ¿Está configurado Supabase? */
export const nubeActiva = (): boolean => Boolean(SUPABASE_URL && SUPABASE_CLAVE);

/** Estado de una suscripción: `ok` = escuchando. */
export type AlEstadoNube = (ok: boolean, mensaje: string) => void;


// -----------------------------------------------------------------------------
// 2. Identificadores
// -----------------------------------------------------------------------------

/** Texto aleatorio e imposible de adivinar, apto para URL (16 bytes → 22 caracteres). */
export function idAleatorio(bytes = 16): string {
  const datos = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...datos)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}


// -----------------------------------------------------------------------------
// 3. Leer y guardar (funciones de la base de datos, por HTTP)
// -----------------------------------------------------------------------------

async function llamar<T>(funcion: string, datos: Record<string, unknown>): Promise<T> {
  const respuesta = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${funcion}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_CLAVE, 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  });
  if (!respuesta.ok) {
    const detalle = (await respuesta.json().catch(() => ({}))) as { message?: string };
    throw new Error(detalle.message || `Supabase respondió ${respuesta.status}`);
  }
  return (respuesta.status === 204 ? null : await respuesta.json()) as T;
}

/** La configuración guardada de un widget, o `null` si todavía no hay. */
export const leerConfigNube = (id: string): Promise<ConfigWidget | null> =>
  llamar<ConfigWidget | null>('leer_widget', { p_id: id });

/** Guarda la configuración de un widget; Supabase avisa solo a los widgets abiertos. */
export const guardarConfigNube = (id: string, secreto: string, config: ConfigWidget): Promise<unknown> =>
  llamar('guardar_widget', { p_id: id, p_secreto: secreto, p_config: config });


// -----------------------------------------------------------------------------
// 4. Escuchar cambios (Realtime Broadcast)
// -----------------------------------------------------------------------------

let cliente: SupabaseClient | null = null; // un solo cliente de Realtime por página (puede escuchar varios canales)

/**
 * Se suscribe al canal público `canal` y llama `releer()` al conectarse, al reconectarse y
 * con cada aviso `evento`. Devuelve una función para dejar de escuchar.
 * La librería se carga aparte (import dinámico): solo la descargan las páginas que escuchan.
 */
async function escucharCanal(canal: string, evento: string, releer: () => void, alEstado: AlEstadoNube = () => {}): Promise<() => void> {
  const { createClient } = await import('@supabase/supabase-js');
  cliente ??= createClient(SUPABASE_URL, SUPABASE_CLAVE, { auth: { persistSession: false } });
  const actual = cliente;
  const suscripcion: RealtimeChannel = actual
    .channel(canal, { config: { private: false } })
    .on('broadcast', { event: evento }, releer)
    .subscribe((estado) => {
      if (estado === 'SUBSCRIBED') {
        alEstado(true, 'Cambios en vivo activos');
        releer();
      } else if (estado !== 'CLOSED') {
        // CHANNEL_ERROR o TIMED_OUT: la librería reintenta sola.
        alEstado(false, 'Cambios en vivo: reconectando…');
      }
    });
  return () => { void actual.removeChannel(suscripcion); };
}

/**
 * Llama `alRecibir(config)` con la configuración actual y cada vez que el panel la cambie.
 * Al conectarse (y al reconectarse tras un corte) vuelve a leerla, por si hubo cambios
 * mientras no estaba escuchando. `alEstado(ok, mensaje)` informa cómo va la conexión.
 *
 * El canal es público: cualquiera que conozca el id podría mandar un mensaje por él. Por eso
 * el aviso solo sirve de señal y la configuración se lee siempre de la tabla (leer_widget),
 * que solo cambia quien tiene el secreto.
 * Devuelve una función para dejar de escuchar.
 */
export async function escucharConfigNube(
  id: string, alRecibir: (config: ConfigWidget) => void, alEstado: AlEstadoNube = () => {},
): Promise<() => void> {
  async function releer(): Promise<void> {
    try {
      const config = await leerConfigNube(id);
      if (config) alRecibir(config);
    } catch (error) {
      alEstado(false, `No se pudo leer la configuración: ${(error as Error).message}`);
    }
  }
  return escucharCanal(`widget-${id}`, 'config', () => { void releer(); }, alEstado);
}


// -----------------------------------------------------------------------------
// 5. Cola de retos (tabla `retos`, ver supabase/esquema.sql)
// -----------------------------------------------------------------------------
// La cola se identifica con el id del widget "Cola de retos" (su `w`).

export interface Reto {
  id: number | string;
  texto: string;
  usuario: string;
  origen: string;
  imagen: string;
  cantidad: number;
  creado: string;
  hecho?: string | null;
}

/** Lo que devuelve leer_retos. */
export interface ColaDeRetos {
  /** Del más viejo al más nuevo, hasta 200. */
  pendientes: Reto[];
  total: number;
  /** Los 10 últimos hechos. */
  hechos: Reto[];
}

export interface RetoNuevo {
  texto: string;
  usuario?: string;
  origen?: string;
  imagen?: string;
  cantidad?: number;
}

/**
 * Agrega un reto al final de la cola. Lo llaman los widgets en OBS (no hace falta el secreto).
 * Devuelve el id del reto nuevo.
 */
export const agregarReto = (cola: string, { texto, usuario = '', origen = '', imagen = '', cantidad = 1 }: RetoNuevo): Promise<unknown> =>
  llamar('agregar_reto', {
    p_cola: cola, p_texto: texto, p_usuario: usuario, p_origen: origen, p_imagen: imagen, p_cantidad: cantidad,
  });

/** { pendientes, total, hechos } */
export const leerRetos = (cola: string): Promise<ColaDeRetos> => llamar<ColaDeRetos>('leer_retos', { p_cola: cola });

/** Marca un reto como hecho (o, con `hecho = false`, lo devuelve a pendiente). Pide el secreto. */
export const marcarReto = (cola: string, secreto: string, id: Reto['id'], hecho = true): Promise<unknown> =>
  llamar('marcar_reto', { p_cola: cola, p_secreto: secreto, p_id: id, p_hecho: hecho });

/** Borra todos los retos de la cola (pendientes y hechos). Pide el secreto. */
export const vaciarRetos = (cola: string, secreto: string): Promise<unknown> =>
  llamar('vaciar_retos', { p_cola: cola, p_secreto: secreto });

/**
 * Llama `alRecibir(cola)` (lo que devuelve leerRetos) al conectarse y cada vez que la cola
 * cambie. Además relee cada `respaldoMs`, por si se perdió un aviso. Devuelve una función
 * para dejar de escuchar.
 */
export async function escucharRetos(
  cola: string,
  alRecibir: (datos: ColaDeRetos) => void,
  { alEstado = () => {}, respaldoMs = 30000 }: { alEstado?: AlEstadoNube; respaldoMs?: number } = {},
): Promise<() => void> {
  let ultima = 0;
  async function releer(): Promise<void> {
    const pedido = ++ultima;
    try {
      const datos = await leerRetos(cola);
      if (pedido === ultima) alRecibir(datos); // si llegaron dos avisos seguidos, vale la última lectura
    } catch (error) {
      alEstado(false, `No se pudo leer la cola de retos: ${(error as Error).message}`);
    }
  }
  const dejar = await escucharCanal(`retos-${cola}`, 'retos', () => { void releer(); }, alEstado);
  const respaldo = setInterval(() => { void releer(); }, respaldoMs);
  return () => {
    clearInterval(respaldo);
    dejar();
  };
}
