// =============================================================================
// nube.js — Cambios en vivo con Supabase (lo usan el panel y los widgets)
//
// Sin Supabase, toda la configuración de un widget viaja en su URL (#c=…) y hay que volver
// a copiarla tras cada cambio. Con Supabase, la URL solo lleva usuario, clave e identificador
// del widget (w); la configuración se guarda en Supabase y el widget la recibe al instante.
//
//   Panel  ──guardar_widget(id, secreto, config)──►  Supabase  ──Realtime "widget-<id>"──►  Widget
//
// La base de datos está descrita en supabase/esquema.sql. Si SUPABASE_URL o SUPABASE_CLAVE
// están vacíos, todo funciona como antes (configuración completa en la URL).
//
// Secciones: 1. Proyecto · 2. Identificadores · 3. Leer y guardar · 4. Escuchar cambios
// =============================================================================


// -----------------------------------------------------------------------------
// 1. Proyecto de Supabase
// -----------------------------------------------------------------------------
// Están en Supabase → Project Settings → API. La clave es la pública ("publishable" o
// "anon"): está hecha para ir en páginas web; la tabla solo se toca con las funciones
// de esquema.sql. NUNCA pongas aquí la clave secreta ("secret" o "service_role").

const SUPABASE_URL = 'https://sjiptivsxisnyleyanxk.supabase.co';
const SUPABASE_CLAVE = 'sb_publishable_toPcSh0sxSlOwfF_CktJ3w_PKnYIoiQ';

// Librería oficial, solo para Realtime (versión fija para que no cambie sola).
const LIBRERIA = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm';

/** ¿Está configurado Supabase? */
export const nubeActiva = () => Boolean(SUPABASE_URL && SUPABASE_CLAVE);


// -----------------------------------------------------------------------------
// 2. Identificadores
// -----------------------------------------------------------------------------

/** Texto aleatorio e imposible de adivinar, apto para URL (16 bytes → 22 caracteres). */
export function idAleatorio(bytes = 16) {
  const datos = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...datos)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}


// -----------------------------------------------------------------------------
// 3. Leer y guardar (funciones de la base de datos, por HTTP)
// -----------------------------------------------------------------------------

async function llamar(funcion, datos) {
  const respuesta = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${funcion}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_CLAVE, 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  });
  if (!respuesta.ok) {
    const detalle = await respuesta.json().catch(() => ({}));
    throw new Error(detalle.message || `Supabase respondió ${respuesta.status}`);
  }
  return respuesta.status === 204 ? null : respuesta.json();
}

/** La configuración guardada de un widget, o `null` si todavía no hay. */
export const leerConfigNube = (id) => llamar('leer_widget', { p_id: id });

/** Guarda la configuración de un widget; Supabase avisa solo a los widgets abiertos. */
export const guardarConfigNube = (id, secreto, config) =>
  llamar('guardar_widget', { p_id: id, p_secreto: secreto, p_config: config });


// -----------------------------------------------------------------------------
// 4. Escuchar cambios (Realtime Broadcast)
// -----------------------------------------------------------------------------

/**
 * Llama `alRecibir(config)` con la configuración actual y cada vez que el panel la cambie.
 * Al conectarse (y al reconectarse tras un corte) vuelve a leerla, por si hubo cambios
 * mientras no estaba escuchando. `alEstado(ok, mensaje)` informa cómo va la conexión.
 *
 * El canal es público: cualquiera que conozca el id podría mandar un mensaje por él. Por eso
 * el aviso solo sirve de señal y la configuración se lee siempre de la tabla (leer_widget),
 * que solo cambia quien tiene el secreto. (El aviso sigue trayendo la configuración para los
 * widgets que aún tengan el código anterior en memoria.)
 */
export async function escucharConfigNube(id, alRecibir, alEstado = () => {}) {
  const { createClient } = await import(LIBRERIA);
  const cliente = createClient(SUPABASE_URL, SUPABASE_CLAVE, { auth: { persistSession: false } });

  async function releer() {
    try {
      const config = await leerConfigNube(id);
      if (config) alRecibir(config);
    } catch (error) {
      alEstado(false, `No se pudo leer la configuración: ${error.message}`);
    }
  }

  cliente
    .channel(`widget-${id}`, { config: { private: false } })
    .on('broadcast', { event: 'config' }, releer)
    .subscribe((estado) => {
      if (estado === 'SUBSCRIBED') {
        alEstado(true, 'Cambios en vivo activos');
        releer();
      } else if (estado !== 'CLOSED') {
        // CHANNEL_ERROR o TIMED_OUT: la librería reintenta sola.
        alEstado(false, 'Cambios en vivo: reconectando…');
      }
    });
}
