// =============================================================================
// comun.js — Piezas compartidas por los widgets (ruleta, metas, alertas…) y el panel.
//
// Un widget es una página .html que se pone en OBS. Toda su configuración viaja en la
// propia URL, después de "#c=", así que funciona sin servidor: se conecta a TikTok desde
// el navegador a través de Euler Stream y reacciona a los eventos del LIVE.
//
// Secciones:
//   1. Configuración en la URL       codificar · decodificar · leerConfig
//   2. Eventos normalizados          normalizar · crearRastreadorRegalos
//   3. Conexión con TikTok           conectarTikTok
//   4. Arranque de widgets           iniciarWidget · avisarPadre
//   5. Utilidades                    sonar · esperar
// =============================================================================


// -----------------------------------------------------------------------------
// 1. Configuración en la URL
// -----------------------------------------------------------------------------
// La configuración va en el fragmento (#c=…) porque el navegador nunca lo envía a ningún
// servidor: ni GitHub Pages ni nadie ve la clave al cargar la página. Se guarda como
// JSON → UTF-8 → base64 "url-safe" (sin + / =), para que no se rompa al copiarla.

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

/** La configuración del widget: `null` si la URL no trae, o `{ error: true }` si viene dañada. */
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
// Ojo: TikTok casi nunca manda los detalles del regalo (giftDetails), así que en los
// regalos `nombre` suele llegar vacío y `diamantes` en 0. El giftId sí llega siempre.

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
// (1 = combo), pero TikTok casi nunca lo manda. Así que, cuando no se sabe el tipo:
//   - cada mensaje reinicia una espera corta; si se cumple sin más mensajes, se cuenta lo que hay
//     (así un regalo suelto se cuenta a los ~2 s);
//   - si después llega el fin de racha, solo se suma lo que faltaba (un combo nunca se cuenta doble).
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
    const racha = rachas.get(clave) || { emitidos: 0 };
    clearTimeout(racha.espera);
    clearTimeout(racha.olvido);
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

/**
 * Arranque común de un widget configurado por la URL (#c=…):
 *   ?fondo=1  → fondo gris y píldora de estado (vista previa del panel)
 *   ?prueba=1 → no se conecta a TikTok; solo recibe eventos de prueba del panel
 * Los eventos de prueba y los reales llegan por el mismo `alEvento`, así el widget
 * no necesita saber de dónde vienen.
 */
export function iniciarWidget({ cfg, alEvento }) {
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

  // Si el panel cambia la configuración (cambia el #c=…), lo más seguro es empezar de cero.
  addEventListener('hashchange', () => location.reload());

  // Eventos de prueba que manda el panel. Solo se aceptan desde el mismo origen.
  addEventListener('message', (ev) => {
    if (ev.origin !== location.origin || ev.data?.tipo !== 'simular' || !ev.data.evento) return;
    alEvento(ev.data.evento);
  });

  if (cfg?.error) return alEstado(false, 'La configuración de la URL está dañada. Cópiala de nuevo desde el panel.');
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
