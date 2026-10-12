// Piezas compartidas por todos los widgets (ruleta, metas, alertas…) y por el panel.
//
// Un widget es una página .html que se pone en OBS. Toda su configuración viaja en la
// propia URL, después de "#c=", así que funciona sin servidor: se conecta a TikTok desde
// el navegador a través de Euler Stream y reacciona a los eventos del LIVE.

// ---------- Configuración en la URL ----------
// Va en el fragmento (#c=…) porque el navegador nunca lo envía a ningún servidor.
export function codificar(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodificar(texto) {
  const bin = atob(texto.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
}

/** La configuración del widget, `null` si la URL no trae, o `{ error: true }` si viene dañada. */
export function leerConfig() {
  const c = new URLSearchParams(location.hash.slice(1)).get('c');
  if (!c) return null;
  try { return decodificar(c); } catch { return { error: true }; }
}

// ---------- Eventos de TikTok, ya simplificados ----------
// Todo lo que llega de Euler Stream se convierte a estos objetos. Los widgets y el panel
// solo conocen esta forma, así que si mañana cambia la fuente de datos, solo cambia este archivo.
//
//   { tipo: 'regalo', usuario, giftId, nombre, cantidad, diamantes, imagen }
//   { tipo: 'like', usuario, cantidad, total }
//   { tipo: 'follow', usuario }
//   { tipo: 'share', usuario }
//   { tipo: 'chat', usuario, texto }
//   { tipo: 'espectadores', cantidad }

const nombreDe = (u) => u?.nickname || u?.uniqueId || 'Alguien';
const imagenDe = (img) => (Array.isArray(img?.url) ? img.url[0] : img?.urlList?.[0]) || '';

export function normalizar({ type, data }) {
  if (!data) return null;
  switch (type) {
    case 'WebcastGiftMessage': {
      // Los regalos en racha (como la rosa) llegan muchas veces mientras dura el combo; solo
      // cuenta el mensaje final (repeatEnd), que trae la cantidad total. El id llega a veces
      // como número y a veces como texto, por eso se pasa siempre a texto.
      const tipo = data.giftDetails?.giftType;
      const enRacha = (tipo === undefined || tipo === 1) && !data.repeatEnd;
      if (enRacha) return null;
      return {
        tipo: 'regalo',
        usuario: nombreDe(data.user),
        giftId: String(data.giftId),
        nombre: data.giftDetails?.giftName || '',
        cantidad: Number(data.repeatCount) || 1,
        diamantes: Number(data.giftDetails?.diamondCount) || 0,
        imagen: imagenDe(data.giftDetails?.giftImage),
      };
    }
    case 'WebcastLikeMessage':
      return { tipo: 'like', usuario: nombreDe(data.user), cantidad: Number(data.likeCount) || 1, total: Number(data.totalLikeCount) || 0 };
    case 'WebcastSocialMessage': {
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

// ---------- Conexión con TikTok vía Euler Stream ----------
// Códigos con los que Euler Stream cierra el WebSocket (los mismos de su SDK oficial).
// El segundo valor es cuánto esperar antes de reintentar; `null` = no reintentar.
const CIERRES = {
  4400: ['Datos inválidos: revisa el usuario de TikTok.', null],
  4401: ['La clave de Euler Stream no es válida.', null],
  4403: ['La clave no tiene permiso para esta cuenta.', null],
  4404: ['@{u} no está en vivo. Reintentando en 30 s…', 30000],
  4005: ['@{u} terminó el LIVE. Reintentando en 30 s…', 30000],
  4429: ['Demasiadas conexiones con esta clave. Reintentando en 60 s…', 60000],
  4555: ['Se cumplieron 8 h de conexión. Reconectando…', 2000],
};

/**
 * Se conecta al LIVE de `usuario` y reintenta solo cuando tiene sentido.
 * `alEvento` recibe eventos ya normalizados; `alEstado(ok, mensaje, final)` el estado de la
 * conexión (`final` = true cuando se rindió y no volverá a intentar).
 * Devuelve `{ cerrar }` para desconectar a propósito.
 */
export function conectarTikTok({ usuario, clave, alEvento, alEstado }) {
  usuario = String(usuario || '').replace(/^@/, '').trim();
  let ws = null;
  let temporizador = null;
  let cerrado = false;
  let espera = 3000;

  function conectar() {
    alEstado(false, `Conectando con @${usuario}…`);
    ws = new WebSocket('wss://ws.eulerstream.com?' + new URLSearchParams({ uniqueId: usuario, apiKey: clave }));

    ws.onmessage = (ev) => {
      if (typeof ev.data !== 'string') return;
      let paquete;
      try { paquete = JSON.parse(ev.data); } catch { return; }
      const mensajes = Array.isArray(paquete?.messages) ? paquete.messages : paquete?.type ? [paquete] : [];
      for (const m of mensajes) {
        if (m.type === 'tiktok.connect' || m.type === 'roomInfo') {
          espera = 3000;
          alEstado(true, `Conectado al LIVE de @${usuario}`);
          continue;
        }
        const evento = normalizar(m);
        if (evento) alEvento(evento);
      }
    };

    ws.onclose = (ev) => {
      if (cerrado) return;
      const conocido = CIERRES[ev.code];
      const [plantilla, reintento] = conocido || [`Se perdió la conexión (código ${ev.code}). Reintentando…`, espera];
      // El tercer argumento avisa que ya no habrá más intentos (clave inválida, usuario malo…).
      alEstado(false, plantilla.replace('{u}', usuario), reintento === null);
      if (reintento === null) return;
      // Para cortes genéricos la espera crece hasta 1 minuto, para no martillar el servicio.
      if (!conocido) espera = Math.min(espera * 2, 60000);
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

// ---------- Utilidades para los widgets ----------
export function avisarPadre(datos) {
  if (window.parent !== window) window.parent.postMessage({ fuente: 'widget', ...datos }, location.origin);
}

/**
 * Arranque común de un widget en modo directo (URL con #c=…):
 *  - ?fondo=1  → fondo gris y píldora de estado (vista previa del panel)
 *  - ?prueba=1 → no se conecta a TikTok; solo recibe eventos de prueba del panel
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

  // Si el panel cambia la configuración, lo más simple y seguro es empezar de cero.
  addEventListener('hashchange', () => location.reload());

  // Eventos de prueba que manda el panel (solo se aceptan desde el mismo origen).
  addEventListener('message', (ev) => {
    if (ev.origin !== location.origin || ev.data?.tipo !== 'simular' || !ev.data.evento) return;
    alEvento(ev.data.evento);
  });

  if (cfg?.error) return alEstado(false, 'La configuración de la URL está dañada. Cópiala de nuevo desde el panel.');
  if (params.get('prueba') === '1') return alEstado(true, 'Modo prueba: sin conexión a TikTok');
  if (!cfg?.u || !cfg?.k) return alEstado(false, 'Falta el usuario de TikTok o la clave de Euler Stream en la URL.');

  conectarTikTok({ usuario: cfg.u, clave: cfg.k, alEvento, alEstado });
}

/** Un "ding" corto sintetizado, para no depender de archivos de audio. */
let audio;
export function sonar({ frecuencia = 880, duracion = 0.25, volumen = 0.15 } = {}) {
  try {
    audio ??= new AudioContext();
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(frecuencia, audio.currentTime);
    o.frequency.exponentialRampToValueAtTime(frecuencia * 1.5, audio.currentTime + duracion * 0.4);
    g.gain.setValueAtTime(volumen, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duracion);
    o.connect(g).connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + duracion);
  } catch { /* sin audio disponible */ }
}

export const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
