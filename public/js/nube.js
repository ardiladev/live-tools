// =============================================================================
// nube.js — Cambios en vivo con Supabase (lo usan el panel y los widgets)
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
//
// Secciones: 1. Proyecto · 2. Identificadores · 3. Leer y guardar · 4. Escuchar cambios
//            5. Cola de retos
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
  async function releer() {
    try {
      const config = await leerConfigNube(id);
      if (config) alRecibir(config);
    } catch (error) {
      alEstado(false, `No se pudo leer la configuración: ${error.message}`);
    }
  }
  await escucharCanal(`widget-${id}`, 'config', releer, alEstado);
}

let cliente = null; // un solo cliente de Realtime por página (puede escuchar varios canales)

/**
 * Se suscribe al canal público `canal` y llama `releer()` al conectarse, al reconectarse y
 * con cada aviso `evento`. Devuelve una función para dejar de escuchar.
 */
async function escucharCanal(canal, evento, releer, alEstado = () => {}) {
  const { createClient } = await import(LIBRERIA);
  cliente ??= createClient(SUPABASE_URL, SUPABASE_CLAVE, { auth: { persistSession: false } });
  const suscripcion = cliente
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
  return () => cliente.removeChannel(suscripcion);
}


// -----------------------------------------------------------------------------
// 5. Cola de retos (tabla `retos`, ver supabase/esquema.sql)
// -----------------------------------------------------------------------------
// La cola se identifica con el id del widget "Cola de retos" (su `w`). Un reto es
// { id, texto, usuario, origen, imagen, cantidad, creado, hecho? }.

/**
 * Agrega un reto al final de la cola. Lo llaman los widgets en OBS (no hace falta el secreto).
 * Devuelve el id del reto nuevo.
 */
export const agregarReto = (cola, { texto, usuario = '', origen = '', imagen = '', cantidad = 1 }) =>
  llamar('agregar_reto', {
    p_cola: cola, p_texto: texto, p_usuario: usuario, p_origen: origen, p_imagen: imagen, p_cantidad: cantidad,
  });

/** { pendientes: [reto…] (del más viejo al más nuevo, hasta 200), total, hechos: [los 10 últimos] } */
export const leerRetos = (cola) => llamar('leer_retos', { p_cola: cola });

/** Marca un reto como hecho (o, con `hecho = false`, lo devuelve a pendiente). Pide el secreto. */
export const marcarReto = (cola, secreto, id, hecho = true) =>
  llamar('marcar_reto', { p_cola: cola, p_secreto: secreto, p_id: id, p_hecho: hecho });

/** Borra todos los retos de la cola (pendientes y hechos). Pide el secreto. */
export const vaciarRetos = (cola, secreto) => llamar('vaciar_retos', { p_cola: cola, p_secreto: secreto });

/**
 * Llama `alRecibir(cola)` (lo que devuelve leerRetos) al conectarse y cada vez que la cola
 * cambie. Además relee cada `respaldoMs`, por si se perdió un aviso. Devuelve una función
 * para dejar de escuchar.
 */
export async function escucharRetos(cola, alRecibir, { alEstado = () => {}, respaldoMs = 30000 } = {}) {
  let ultima = 0;
  async function releer() {
    const pedido = ++ultima;
    try {
      const datos = await leerRetos(cola);
      if (pedido === ultima) alRecibir(datos); // si llegaron dos avisos seguidos, vale la última lectura
    } catch (error) {
      alEstado(false, `No se pudo leer la cola de retos: ${error.message}`);
    }
  }
  const dejar = await escucharCanal(`retos-${cola}`, 'retos', releer, alEstado);
  const respaldo = setInterval(releer, respaldoMs);
  return () => {
    clearInterval(respaldo);
    dejar();
  };
}
