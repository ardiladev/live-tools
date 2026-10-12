// =============================================================================
// panel-local.js — Panel del modo local (panel.html, solo con `npm start`)
//
// Habla con server.js por socket.io:
//   envía:   conectar · desconectar · simular · guardarPremios
//   recibe:  config · estado · historial · giro · aviso
//
// Secciones: 1. Utilidades · 2. Conexión · 3. Simulación · 4. Premios · 5. Historial
// =============================================================================

/* global io -- lo define /socket.io/socket.io.js, que se carga antes que este archivo */
const socket = io();
const $ = (id) => document.getElementById(id);


// -----------------------------------------------------------------------------
// 1. Utilidades
// -----------------------------------------------------------------------------

/** Crea un elemento con clase, texto y atributos (sin innerHTML). */
function crear(etiqueta, { clase, texto, ...atributos } = {}) {
  const nodo = document.createElement(etiqueta);
  if (clase) nodo.className = clase;
  if (texto !== undefined) nodo.textContent = texto;
  Object.entries(atributos).forEach(([k, v]) => nodo.setAttribute(k, v));
  return nodo;
}

const horaCorta = (iso) => new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

$('urlOverlay').textContent = `${location.origin}/ruleta`;


// -----------------------------------------------------------------------------
// 2. Conexión con el LIVE (la hace el servidor)
// -----------------------------------------------------------------------------

$('btnConectar').addEventListener('click', () => socket.emit('conectar', { usuario: $('usuario').value }));
$('usuario').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btnConectar').click(); });
$('btnDesconectar').addEventListener('click', () => socket.emit('desconectar'));

socket.on('estado', (estado) => {
  $('mensaje').textContent = estado.mensaje;
  $('punto').classList.toggle('ok', estado.conectado);
  $('btnDesconectar').disabled = !estado.conectado;
  if (estado.usuario && !$('usuario').value) $('usuario').value = estado.usuario;
});

socket.on('disconnect', () => {
  $('mensaje').textContent = 'El servidor no responde. ¿Sigue abierta la terminal?';
  $('punto').classList.remove('ok');
});


// -----------------------------------------------------------------------------
// 3. Simulación: regalos de prueba sin estar en vivo
// -----------------------------------------------------------------------------

document.querySelectorAll('[data-cantidad]').forEach((boton) => {
  boton.addEventListener('click', () => {
    socket.emit('simular', { usuario: $('nombrePrueba').value, cantidad: Number(boton.dataset.cantidad) });
  });
});


// -----------------------------------------------------------------------------
// 4. Premios (se guardan en config.json a través del servidor)
// -----------------------------------------------------------------------------

let premios = [];
let probabilidades = []; // los <div> de porcentaje, en el mismo orden que `premios`

/** Reescribe solo los porcentajes (redibujar la lista quitaría el foco del campo). */
function pintarProbabilidades() {
  const total = premios.reduce((suma, p) => suma + Math.max(0, Number(p.peso) || 0), 0) || 1;
  probabilidades.forEach((div, i) => {
    div.textContent = `${Math.round((Math.max(0, Number(premios[i].peso) || 0) / total) * 100)}% de probabilidad`;
  });
}

function pintarPremios() {
  const lista = $('listaPremios');
  lista.replaceChildren();
  probabilidades = [];

  premios.forEach((premio, i) => {
    const texto = crear('input', { 'aria-label': `Premio ${i + 1}`, maxlength: '40' });
    const peso = crear('input', { 'aria-label': `Peso del premio ${i + 1}`, type: 'number', min: '0', step: '1' });
    const quitar = crear('button', { texto: '✕', 'aria-label': `Quitar premio ${i + 1}`, title: 'Quitar' });
    texto.value = premio.texto;
    peso.value = premio.peso;
    texto.addEventListener('input', () => { premio.texto = texto.value; });
    peso.addEventListener('input', () => { premio.peso = Number(peso.value); pintarProbabilidades(); });
    quitar.addEventListener('click', () => { premios.splice(i, 1); pintarPremios(); });

    const fila = crear('div', { clase: 'premio' });
    fila.append(texto, peso, quitar);
    const probabilidad = crear('div', { clase: 'probabilidad' });
    probabilidades.push(probabilidad);
    lista.append(fila, probabilidad);
  });
  pintarProbabilidades();
}

$('btnAgregar').addEventListener('click', () => { premios.push({ texto: 'Nuevo premio', peso: 1 }); pintarPremios(); });
$('btnGuardar').addEventListener('click', () => socket.emit('guardarPremios', premios));

socket.on('config', (cfg) => {
  premios = cfg.premios.map((p) => ({ ...p }));
  pintarPremios();
});

let temporizadorAviso;
socket.on('aviso', (texto) => {
  $('aviso').textContent = texto;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => { $('aviso').textContent = ''; }, 3500);
});


// -----------------------------------------------------------------------------
// 5. Historial de giros
// -----------------------------------------------------------------------------

const MAX_HISTORIAL = 30;
let historial = [];

function pintarHistorial() {
  const lista = $('historial');
  if (!historial.length) {
    lista.replaceChildren(crear('li', { clase: 'vacio', texto: 'Todavía no hay giros. Envía una rosa de prueba.' }));
    return;
  }
  lista.replaceChildren(...historial.slice(0, MAX_HISTORIAL).map((giro) => {
    const li = crear('li');
    li.append(
      crear('span', { texto: `${giro.usuario} → ${giro.premio}` }),
      crear('span', { clase: 'etiqueta', texto: `${giro.origen === 'tiktok' ? 'LIVE' : 'Prueba'} · ${horaCorta(giro.hora)}` }));
    return li;
  }));
}

socket.on('historial', (h) => { historial = h; pintarHistorial(); });
socket.on('giro', (giro) => { historial.unshift(giro); pintarHistorial(); });
