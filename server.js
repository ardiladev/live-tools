// Demo: Ruleta activada por regalos de TikTok LIVE
// Escucha los regalos de un LIVE y, cuando llega el regalo configurado
// (por defecto la Rosa), manda un giro de ruleta al overlay.

import express from 'express';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';
import { crearRastreadorRegalos } from './public/js/comun.js';

const CONFIG_PATH = new URL('./config.json', import.meta.url);
// config.json no se sube al repositorio (lleva usuario, premios y clave): en una copia
// nueva se arranca desde el ejemplo.
if (!existsSync(CONFIG_PATH)) copyFileSync(new URL('./config.example.json', import.meta.url), CONFIG_PATH);
let config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
const guardarConfig = () => writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

// La librería fija un timeout de 10 s por petición HTTP y descarta cualquier
// `timeout` que se le pase en `webClientOptions`: la ÚNICA palanca es esta variable
// de entorno, y hay que fijarla antes de crear la primera conexión. Un arranque en
// frío (DNS + TLS + servidor de firmas) puede pasar de 10 s y tumbaba el connect.
process.env.TIKTOK_CLIENT_TIMEOUT ||= String(config.timeoutMs || 30000);

const app = express();
const http = createServer(app);
const io = new Server(http);

const PUBLIC_DIR = fileURLToPath(new URL('./public', import.meta.url));
// La redirección va ANTES del estático: si no, `/` serviría index.html (el generador
// para GitHub Pages) en lugar del panel del servidor local.
app.get('/', (_req, res) => res.redirect('/panel'));
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

// ---------- Estado ----------
let conexion = null;
let estado = { conectado: false, usuario: config.usuario || '', mensaje: 'Sin conexión' };
const historial = [];

function emitirEstado(cambios) {
  estado = { ...estado, ...cambios };
  io.emit('estado', estado);
  console.log(`[estado] ${estado.mensaje}`);
}

// ---------- Lógica de la ruleta ----------
function elegirPremio() {
  const premios = config.premios;
  const total = premios.reduce((s, p) => s + (p.peso > 0 ? p.peso : 0), 0);
  let r = Math.random() * total;
  for (let i = 0; i < premios.length; i++) {
    r -= Math.max(premios[i].peso, 0);
    if (r < 0) return i;
  }
  return premios.length - 1;
}

function lanzarGiros(usuario, cantidadRegalos, origen) {
  const giros = Math.min(cantidadRegalos * config.girosPorRegalo, config.maxGirosPorEvento);
  for (let i = 0; i < giros; i++) {
    const indice = elegirPremio();
    const giro = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      usuario,
      indice,
      premio: config.premios[indice].texto,
      origen,
      hora: new Date().toISOString(),
    };
    historial.unshift(giro);
    historial.length = Math.min(historial.length, 50);
    io.emit('giro', giro);
  }
  console.log(`[giro] ${usuario} → ${giros} giro(s) (${origen})`);
}

function esRegaloObjetivo(data) {
  // TikTok manda `giftId` como CADENA ("5655"), aunque los tipos de la librería lo
  // declaren `number`. El `===` contra el número de config.json daba siempre false,
  // y por eso ninguna rosa real activaba la ruleta. Se comparan como texto.
  if (config.regalo.giftId && String(data.giftId) === String(config.regalo.giftId)) return true;

  // Respaldo por nombre. En los eventos reales `giftDetails` no llega, así que esto
  // casi nunca entra; se conserva por si TikTok vuelve a incluirlo. El id manda.
  const nombre = (data.giftDetails?.giftName || '').trim().toLowerCase();
  return !!nombre && config.regalo.nombres.some((n) => String(n).trim().toLowerCase() === nombre);
}

// ---------- Conexión con TikTok ----------
const REINTENTOS = 2;
const ESPERA_REINTENTO_MS = 3000;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Contador de "generación": cada intento de conexión se queda con un número y solo
// sigue mandando mientras ese número siga siendo el vigente. Así, si en medio de un
// reintento alguien pulsa Conectar otra vez o Desconectar, el intento viejo se calla
// en lugar de pisar el estado o lanzar giros de una conexión que ya nadie quiere.
let generacion = 0;

// Las rutas compuestas (la de `roomId` prueba HTML, API y Euler por turnos) no
// propagan el fallo original: lo guardan en `config.requestErrs` y lanzan un
// "Failed to retrieve Room ID from all sources". Así que para saber si de verdad
// hubo un timeout hay que bajar por el árbol de errores, no mirar solo el de arriba.
function textoDeError(err, profundidad = 0) {
  if (!err || profundidad > 4) return '';
  const dentro = [
    ...(Array.isArray(err?.config?.requestErrs) ? err.config.requestErrs : []),
    err?.cause,
    err?.originalError,
  ];
  return [err?.name, err?.code, err?.message, ...dentro.map((e) => textoDeError(e, profundidad + 1))]
    .filter(Boolean)
    .join(' | ');
}

// Un timeout o un corte de socket son pasajeros y merecen otro intento.
// Que la cuenta no esté en vivo, no: ahí reintentar solo hace perder tiempo.
function esFalloPasajero(err) {
  return /timeout|etimedout|econnreset|socket hang up|eai_again|epipe|50[234]/i.test(textoDeError(err));
}

function crearConexion(usuario, miGeneracion) {
  const vigente = () => miGeneracion === generacion;

  // OJO: no activar `enableExtendedGiftInfo`. Esa opción pide la lista de regalos
  // de la sala a través de un endpoint de firma que Euler Stream reserva al plan
  // Business, y la conexión falla entera. No hace falta: el nombre y el tipo del
  // regalo ya vienen dentro del propio evento, en `data.giftDetails`.
  const c = new TikTokLiveConnection(usuario, {
    processInitialData: false,
    ...(config.signApiKey ? { signApiKey: config.signApiKey } : {}),
  });

  // Combos (la rosa) y regalos sueltos (el capibara) se distinguen con el mismo rastreador
  // que usan los widgets: ver crearRastreadorRegalos en public/js/comun.js. Antes, sin
  // `giftDetails`, todo regalo se trataba como combo y los sueltos nunca activaban la ruleta.
  const alRegalo = crearRastreadorRegalos((evento) => {
    if (!vigente()) return;
    const coincide = esRegaloObjetivo({ giftId: evento.giftId, giftDetails: { giftName: evento.nombre } });
    // Rastro de TODOS los regalos, no solo de los que activan la ruleta: si un día
    // no gira, aquí se ve si el regalo llegó y por qué se descartó.
    console.log(
      `[regalo] ${evento.nombre || '(sin nombre)'} · id ${evento.giftId} · x${evento.cantidad}` +
      ` · de ${evento.usuario} → ${coincide ? 'activa la ruleta' : 'NO coincide con config.regalo'}`
    );
    if (coincide) lanzarGiros(evento.usuario, evento.cantidad, 'tiktok');
  });

  c.on(WebcastEvent.GIFT, (data) => {
    if (vigente()) alRegalo(data);
  });

  // Sin este listener, un 'error' del emisor tumbaría el proceso de Node en medio del LIVE.
  c.on(ControlEvent.ERROR, (err) => console.error('[tiktok]', err?.message || err));
  c.on(ControlEvent.DISCONNECTED, () => {
    if (vigente()) emitirEstado({ conectado: false, mensaje: `Se perdió la conexión con @${usuario}` });
  });
  c.on(WebcastEvent.STREAM_END, () => {
    if (vigente()) emitirEstado({ conectado: false, mensaje: `@${usuario} terminó el LIVE` });
  });

  return c;
}

function mensajeDeError(err, usuario) {
  if (err?.constructor?.name === 'UserOfflineError') {
    return `@${usuario} no está en vivo. Inicia el LIVE y vuelve a conectar.`;
  }
  if (esFalloPasajero(err)) {
    return 'La red o el servidor de firmas no respondieron a tiempo. Vuelve a intentar en un momento.';
  }
  if (/room id/i.test(String(err?.message))) {
    return `No se encontró un LIVE activo de @${usuario}. Revisa el usuario y que esté en vivo.`;
  }
  return `No se pudo conectar: ${err?.message || err}`;
}

async function conectar(usuario) {
  await desconectar();
  usuario = usuario.replace(/^@/, '').trim();
  if (!usuario) return emitirEstado({ mensaje: 'Escribe un usuario de TikTok' });

  const miGeneracion = ++generacion;
  config.usuario = usuario;
  guardarConfig();
  emitirEstado({ usuario, mensaje: `Conectando con @${usuario}…` });

  for (let intento = 1; intento <= REINTENTOS + 1; intento++) {
    // Una instancia que ya falló no se reutiliza: cada intento arranca limpio.
    const c = crearConexion(usuario, miGeneracion);
    conexion = c;
    try {
      await c.connect();
      if (miGeneracion !== generacion) {
        await c.disconnect().catch(() => {});
        return;
      }
      return emitirEstado({ conectado: true, mensaje: `Conectado al LIVE de @${usuario}` });
    } catch (err) {
      if (conexion === c) conexion = null;
      if (miGeneracion !== generacion) return;

      const ultimo = intento > REINTENTOS;
      if (!ultimo && esFalloPasajero(err)) {
        console.log(`[conectar] intento ${intento} falló (${err?.message || err}); reintentando`);
        emitirEstado({ mensaje: `La conexión tardó demasiado. Reintentando (${intento}/${REINTENTOS})…` });
        await esperar(ESPERA_REINTENTO_MS);
        if (miGeneracion !== generacion) return;
        continue;
      }
      return emitirEstado({ conectado: false, mensaje: mensajeDeError(err, usuario) });
    }
  }
}

async function desconectar() {
  generacion++; // invalida cualquier intento de conexión que siga en curso
  if (!conexion) return;
  const c = conexion;
  conexion = null;
  try { await c.disconnect(); } catch { /* ya estaba cerrada */ }
  emitirEstado({ conectado: false, mensaje: 'Desconectado' });
}

// ---------- Comunicación con el panel y el overlay ----------
io.on('connection', (socket) => {
  socket.emit('config', config);
  socket.emit('estado', estado);
  socket.emit('historial', historial);

  socket.on('conectar', ({ usuario }) => conectar(String(usuario || '')));
  socket.on('desconectar', () => desconectar());

  socket.on('simular', ({ usuario, cantidad }) => {
    const n = Math.max(1, Math.min(Number(cantidad) || 1, 50));
    lanzarGiros(String(usuario || 'Espectador de prueba').slice(0, 40), n, 'simulación');
  });

  socket.on('guardarPremios', (premios) => {
    const limpios = (Array.isArray(premios) ? premios : [])
      .map((p) => ({ texto: String(p.texto || '').trim().slice(0, 40), peso: Math.max(0, Number(p.peso) || 0) }))
      .filter((p) => p.texto);
    if (limpios.length < 2 || !limpios.some((p) => p.peso > 0)) {
      return socket.emit('aviso', 'La ruleta necesita al menos 2 premios y alguno con peso mayor a 0.');
    }
    config.premios = limpios;
    guardarConfig();
    io.emit('config', config);
    socket.emit('aviso', 'Premios guardados.');
  });
});

const PUERTO = Number(process.env.PORT) || config.puerto || 3000;
http.listen(PUERTO, () => {
  console.log(`\nPanel de control:  http://localhost:${PUERTO}/panel`);
  console.log(`Overlay para OBS:  http://localhost:${PUERTO}/ruleta\n`);
});
