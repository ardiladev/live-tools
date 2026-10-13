// =============================================================================
// comun.js — Piezas compartidas por los widgets (ruleta, metas, alertas…) y el panel.
//
// Un widget es una página .html que se pone en OBS. Su URL lleva, después de "#c=", el
// usuario de TikTok, la API key y, o bien el identificador del widget (la configuración
// llega en vivo desde Supabase, ver js/nube.js), o bien toda la configuración. Funciona sin
// servidor propio: se conecta a TikTok desde el navegador a través de Euler Stream y
// reacciona a los eventos del LIVE.
//
// Secciones:
//   1. Configuración en la URL       codificar · decodificar · leerConfig
//   2. Eventos normalizados          normalizar · crearRastreadorRegalos
//   3. Conexión con TikTok           conectarTikTok
//   4. Arranque de widgets           iniciarWidget · avisarPadre · configuración en vivo (Supabase)
//   5. Utilidades                    sonar · esperar
// =============================================================================

import { aplicarTema } from './tema.js';


// -----------------------------------------------------------------------------
// 1. Configuración en la URL
// -----------------------------------------------------------------------------
// Los datos van en el fragmento (#c=…) porque el navegador nunca lo envía a ningún
// servidor: ni GitHub Pages ni nadie ve la clave al cargar la página. Se guardan como
// JSON → UTF-8 → base64 "url-safe" (sin + / =), para que no se rompan al copiarlos.
// El panel también usa `codificar` para la URL de la vista previa.

/** Objeto → texto apto para URL. */
export function codificar(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let binario = '';
  bytes.forEach((b) => { binario += String.fromCharCode(b); });
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Texto de la URL → objeto. Lanza un error si el texto está dañado. */
export function decodificar(texto) {
  const binario = atob(texto.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(binario, (c) => c.charCodeAt(0))));
}

/** Lo que trae el #c= de la URL: `null` si no trae nada, o `{ error: true }` si viene dañado. */
export function leerConfig() {
  const c = new URLSearchParams(location.hash.slice(1)).get('c');
  if (!c) return null;
  try {
    return decodificar(c);
  } catch {
    return { error: true };
  }
}


// -----------------------------------------------------------------------------
// 2. Eventos normalizados
// -----------------------------------------------------------------------------
// Todo lo que llega de Euler Stream se convierte a estos objetos. Los widgets y el panel
// solo conocen esta forma: si mañana cambia la fuente de datos, solo cambia este archivo.
//
//   { tipo: 'regalo', usuario, giftId, nombre, cantidad, diamantes, imagen }
//   { tipo: 'like', usuario, cantidad, total }
//   { tipo: 'follow', usuario }
//   { tipo: 'share', usuario }
//   { tipo: 'chat', usuario, texto }
//   { tipo: 'espectadores', cantidad }
//
// Ojo: TikTok no siempre manda los detalles del regalo (giftDetails). Cuando los manda,
// `nombre` llega en inglés ("Rose"); cuando no, llega vacío y `diamantes` en 0. El giftId
// sí llega siempre, por eso todo se identifica por él.

const nombreDe = (usuario) => usuario?.nickname || usuario?.uniqueId || 'Alguien';
const imagenDe = (imagen) => (Array.isArray(imagen?.url) ? imagen.url[0] : imagen?.urlList?.[0]) || '';

/** Convierte un mensaje de Euler Stream (que no sea un regalo) en un evento normalizado, o `null`. */
export function normalizar({ type, data }) {
  if (!data) return null;
  switch (type) {
    case 'WebcastLikeMessage':
      return {
        tipo: 'like',
        usuario: nombreDe(data.user),
        cantidad: Number(data.likeCount) || 1,
        total: Number(data.totalLikeCount) || 0,
      };
    case 'WebcastSocialMessage': {
      // Seguir y compartir llegan en el mismo tipo de mensaje; los distingue esta clave
      // (la misma regla que usa la librería tiktok-live-connector).
      const clave = `${data.common?.displayText?.key || ''} ${data.common?.displayText?.displayType || ''}`;
      if (clave.includes('follow')) return { tipo: 'follow', usuario: nombreDe(data.user) };
      if (clave.includes('share')) return { tipo: 'share', usuario: nombreDe(data.user) };
      return null;
    }
    case 'WebcastChatMessage':
      return { tipo: 'chat', usuario: nombreDe(data.user), texto: String(data.comment || '') };
    case 'WebcastRoomUserSeqMessage':
      return { tipo: 'espectadores', cantidad: Number(data.viewerCount) || 0 };
    default:
      return null;
  }
}

// ---------- Regalos: combos y regalos sueltos ----------
// Un regalo en combo (la rosa) llega muchas veces mientras dura la racha, con repeatEnd = 0,
// y al final una vez más con repeatEnd = 1 y la cantidad total. Un regalo sin combo (el
// capibara) llega UNA sola vez, con repeatEnd = 0. Lo que los distingue es giftDetails.giftType
// (1 = combo), pero TikTok no siempre lo manda. Así que, cuando no se sabe el tipo:
//   - cada mensaje reinicia una espera corta; si se cumple sin más mensajes, se cuenta lo que hay
//     (así un regalo suelto se cuenta a los ~2 s);
//   - si después llega el fin de racha, solo se suma lo que faltaba (un combo nunca se cuenta doble);
//   - si llega otra vez con una cantidad que ya se contó, es un regalo nuevo y se cuenta aparte.
const ESPERA_RACHA_MS = 2000;   // silencio tras el cual se cuenta lo acumulado
const RECUERDO_RACHA_MS = 60000; // cuánto se recuerda una racha por si llega su fin tarde

/**
 * Devuelve una función que recibe los mensajes crudos de regalo (WebcastGiftMessage.data)
 * y llama a `emitir(eventoNormalizado)` con la cantidad correcta, una vez por regalo.
 */
export function crearRastreadorRegalos(emitir) {
  const rachas = new Map(); // "usuario|regalo|grupo" → { ultimo, emitidos, espera, olvido }

  return function alRegalo(data) {
    const evento = {
      tipo: 'regalo',
      usuario: nombreDe(data.user),
      giftId: String(data.giftId), // llega a veces como número y a veces como texto
      nombre: data.giftDetails?.giftName || '',
      cantidad: Number(data.repeatCount) || 1,
      diamantes: Number(data.giftDetails?.diamondCount) || 0,
      imagen: imagenDe(data.giftDetails?.giftImage),
    };

    // Si TikTok sí dijo el tipo y no es combo, se cuenta de inmediato.
    const tipo = data.giftDetails?.giftType;
    if (tipo !== undefined && tipo !== 1) return emitir(evento);

    const clave = `${data.user?.userId || evento.usuario}|${evento.giftId}|${data.groupId || ''}`;
    let racha = rachas.get(clave) || { emitidos: 0 };
    clearTimeout(racha.espera);
    clearTimeout(racha.olvido);
    // En una racha la cantidad solo crece. Si ya se contó y llega otra vez con la misma
    // cantidad o menos (sin ser el fin), es un regalo NUEVO: dos capibaras seguidos de la
    // misma persona deben contar dos veces.
    if (!data.repeatEnd && racha.emitidos > 0 && evento.cantidad <= racha.emitidos) racha = { emitidos: 0 };
    racha.ultimo = evento;
    rachas.set(clave, racha);

    const emitirFaltante = () => {
      const falta = racha.ultimo.cantidad - racha.emitidos;
      if (falta <= 0) return;
      racha.emitidos += falta;
      emitir({ ...racha.ultimo, cantidad: falta });
    };

    if (data.repeatEnd) {
      emitirFaltante();
      rachas.delete(clave);
      return;
    }
    racha.espera = setTimeout(emitirFaltante, ESPERA_RACHA_MS);
    racha.olvido = setTimeout(() => rachas.delete(clave), RECUERDO_RACHA_MS);
  };
}


// -----------------------------------------------------------------------------
// 3. Conexión con TikTok vía Euler Stream
// -----------------------------------------------------------------------------
// Euler Stream ofrece un WebSocket que entrega los eventos del LIVE ya decodificados en JSON.
// Se usa desde el navegador con la API key en la URL del WebSocket.

const URL_EULER = 'wss://ws.eulerstream.com';
const ESPERA_INICIAL_MS = 3000;
const ESPERA_MAXIMA_MS = 60000;

// Códigos con los que Euler Stream cierra el WebSocket (los mismos de su SDK oficial).
// El segundo valor es cuánto esperar antes de reintentar; `null` = no reintentar.
// Cuando la cuenta no está en vivo se espera 1 min: el plan gratuito permite 500
// solicitudes por hora, y cada widget abierto en OBS reintenta por su cuenta.
const CIERRES = {
  4400: ['Datos inválidos: revisa el usuario de TikTok.', null],
  4401: ['La clave de Euler Stream no es válida.', null],
  4403: ['La clave no tiene permiso para esta cuenta.', null],
  4404: ['@{u} no está en vivo. Reintentando en 1 min…', 60000],
  4005: ['@{u} terminó el LIVE. Reintentando en 1 min…', 60000],
  4429: ['Demasiadas conexiones con esta clave. Reintentando en 1 min…', 60000],
  4555: ['Se cumplieron 8 h de conexión. Reconectando…', 2000],
};

/**
 * Se conecta al LIVE de `usuario` y reintenta solo cuando tiene sentido.
 *   alEvento(evento)              → cada evento normalizado (ver sección 2)
 *   alEstado(ok, mensaje, final)  → estado de la conexión; `final` = se rindió (clave mala…)
 * Devuelve `{ cerrar }` para desconectar a propósito.
 */
export function conectarTikTok({ usuario, clave, alEvento, alEstado }) {
  usuario = String(usuario || '').replace(/^@/, '').trim();
  let ws = null;
  let temporizador = null;
  let cerrado = false;
  let espera = ESPERA_INICIAL_MS;
  const alRegalo = crearRastreadorRegalos(alEvento);

  function procesarMensaje(m) {
    // Euler confirma que ya está conectado a la sala con cualquiera de estos dos.
    if (m.type === 'tiktok.connect' || m.type === 'roomInfo') {
      espera = ESPERA_INICIAL_MS;
      alEstado(true, `Conectado al LIVE de @${usuario}`);
      return;
    }
    if (m.type === 'WebcastGiftMessage') {
      if (m.data) alRegalo(m.data);
      return;
    }
    const evento = normalizar(m);
    if (evento) alEvento(evento);
  }

  function conectar() {
    alEstado(false, `Conectando con @${usuario}…`);
    ws = new WebSocket(`${URL_EULER}?${new URLSearchParams({ uniqueId: usuario, apiKey: clave })}`);

    ws.onmessage = (ev) => {
      if (typeof ev.data !== 'string') return;
      let paquete;
      try {
        paquete = JSON.parse(ev.data);
      } catch {
        return;
      }
      // Por defecto Euler agrupa varios mensajes en { messages: [...] }.
      const mensajes = Array.isArray(paquete?.messages) ? paquete.messages : paquete?.type ? [paquete] : [];
      mensajes.forEach(procesarMensaje);
    };

    ws.onclose = (ev) => {
      if (cerrado) return;
      const conocido = CIERRES[ev.code];
      const [plantilla, reintento] = conocido || [`Se perdió la conexión (código ${ev.code}). Reintentando…`, espera];
      alEstado(false, plantilla.replace('{u}', usuario), reintento === null);
      if (reintento === null) return;
      // Para cortes genéricos la espera se duplica hasta 1 min, para no martillar el servicio.
      if (!conocido) espera = Math.min(espera * 2, ESPERA_MAXIMA_MS);
      temporizador = setTimeout(conectar, reintento);
    };
  }

  conectar();

  return {
    cerrar() {
      cerrado = true;
      clearTimeout(temporizador);
      ws?.close(1000);
      alEstado(false, 'Desconectado');
    },
  };
}


// -----------------------------------------------------------------------------
// 4. Arranque de widgets
// -----------------------------------------------------------------------------

/** Manda un mensaje a la página que contiene al widget (el panel, en la vista previa). */
export function avisarPadre(datos) {
  if (window.parent !== window) window.parent.postMessage({ fuente: 'widget', ...datos }, location.origin);
}

// Copia de la última configuración recibida de Supabase, por widget (clave + identificador).
const CLAVE_CACHE = 'live-tools:widget:';

function leerCache(id) {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_CACHE + id) || 'null');
  } catch {
    return null;
  }
}

function guardarCache(id, config) {
  try {
    localStorage.setItem(CLAVE_CACHE + id, JSON.stringify(config));
  } catch {
    // Sin almacenamiento: el widget sigue funcionando, solo que sin copia de respaldo.
  }
}

/**
 * Configuración en vivo: la URL solo trae usuario (u), clave (k) e identificador (w).
 * Primero se usa la última configuración recibida (guardada en este navegador, por si
 * Supabase no responde) y después la que llega de Supabase, cada vez que el panel cambia algo.
 * `_v` es la hora en que el panel la guardó: una versión más vieja que llegue tarde se ignora.
 */
function sincronizarConfig(cfgUrl, alConfig) {
  const propios = { u: cfgUrl.u, k: cfgUrl.k, w: cfgUrl.w };
  let version = 0;

  function aplicar(config) {
    const v = Number(config?._v) || 0;
    if (v && v <= version) return;
    version = v;
    alConfig({ ...config, ...propios });
  }

  aplicar(leerCache(cfgUrl.w) || {});

  import('./nube.js')
    .then(({ nubeActiva, escucharConfigNube }) => {
      if (!nubeActiva()) return console.warn('[widget] Esta URL usa cambios en vivo, pero Supabase no está configurado.');
      return escucharConfigNube(cfgUrl.w, (config) => {
        guardarCache(cfgUrl.w, config);
        aplicar(config);
      }, (ok, mensaje) => console.log(`[widget] ${mensaje}`));
    })
    .catch((error) => console.warn(`[widget] Sin cambios en vivo: ${error.message}`));
}

/**
 * Arranque común de un widget:
 *   ?fondo=1  → fondo gris y píldora de estado (vista previa del panel)
 *   ?prueba=1 → no se conecta a TikTok; solo recibe eventos de prueba del panel
 * Los eventos de prueba y los reales llegan por el mismo `alEvento`, así el widget
 * no necesita saber de dónde vienen.
 * `alConfig(config)` recibe la configuración: una vez al arrancar (la de la URL) y, si la
 * URL usa cambios en vivo (#c= con `w`), otra vez cada vez que se edite en el panel.
 * El estilo visual (`est`, ver js/tema.js) se aplica aquí, antes de pasarle la configuración
 * al widget, así cada widget solo se ocupa de su contenido.
 */
export function iniciarWidget({ cfg, alEvento, alConfig: alConfigWidget = () => {} }) {
  const alConfig = (config) => {
    aplicarTema(config.est);
    alConfigWidget(config);
  };

  const params = new URLSearchParams(location.search);
  const vistaPrevia = params.get('fondo') === '1';
  if (vistaPrevia) document.body.classList.add('vista-previa');

  const pildora = document.createElement('div');
  pildora.className = 'pildora-estado';
  pildora.hidden = true;
  document.body.append(pildora);

  function alEstado(ok, mensaje) {
    console.log(`[widget] ${mensaje}`);
    pildora.textContent = mensaje;
    pildora.classList.toggle('ok', ok);
    pildora.hidden = !vistaPrevia;
    avisarPadre({ tipo: 'estado', ok, mensaje });
  }

  // Si cambia el #c=… de la URL (por ejemplo, en la vista previa del panel), lo más seguro
  // es empezar de cero. Los cambios en vivo de Supabase NO pasan por aquí: no recargan.
  addEventListener('hashchange', () => location.reload());

  // Mensajes del panel (vista previa). Solo se aceptan desde el mismo origen:
  //   simular → un evento de prueba · tema → el estilo nuevo, sin recargar la página
  //   config  → la configuración completa, sin recargar (p. ej. el reloj de la carrera)
  addEventListener('message', (ev) => {
    if (ev.origin !== location.origin) return;
    if (ev.data?.tipo === 'simular' && ev.data.evento) alEvento(ev.data.evento);
    if (ev.data?.tipo === 'tema' && ev.data.est) aplicarTema(ev.data.est);
    if (ev.data?.tipo === 'config' && ev.data.config) alConfig(ev.data.config);
  });

  if (cfg?.error) return alEstado(false, 'La configuración de la URL está dañada. Cópiala de nuevo desde el panel.');
  if (cfg?.w) sincronizarConfig(cfg, alConfig);
  else alConfig(cfg || {});
  if (params.get('prueba') === '1') return alEstado(true, 'Modo prueba: sin conexión a TikTok');
  if (!cfg?.u || !cfg?.k) return alEstado(false, 'Falta el usuario de TikTok o la clave de Euler Stream en la URL.');

  conectarTikTok({ usuario: cfg.u, clave: cfg.k, alEvento, alEstado });
}


// -----------------------------------------------------------------------------
// 5. Utilidades
// -----------------------------------------------------------------------------

let audio; // un solo AudioContext para toda la página (los navegadores limitan cuántos hay)

/**
 * Un sonido corto sintetizado, para no depender de archivos de audio.
 *   onda: 'sine' | 'triangle' | 'square' | 'sawtooth'
 *   subida: cuánto sube el tono (1 = tono fijo)
 */
export function sonar({ frecuencia = 880, duracion = 0.25, volumen = 0.15, onda = 'sine', subida = 1.5 } = {}) {
  try {
    audio ??= new AudioContext();
    const t = audio.currentTime;
    const oscilador = audio.createOscillator();
    const ganancia = audio.createGain();
    oscilador.type = onda;
    oscilador.frequency.setValueAtTime(frecuencia, t);
    if (subida !== 1) oscilador.frequency.exponentialRampToValueAtTime(frecuencia * subida, t + duracion * 0.4);
    ganancia.gain.setValueAtTime(volumen, t);
    ganancia.gain.exponentialRampToValueAtTime(0.001, t + duracion);
    oscilador.connect(ganancia).connect(audio.destination);
    oscilador.start();
    oscilador.stop(t + duracion);
  } catch {
    // Sin audio disponible (o bloqueado por el navegador): el widget sigue funcionando.
  }
}

/** Promesa que se cumple tras `ms` milisegundos. */
export const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));
