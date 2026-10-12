// =============================================================================
// app.js — Arranque del panel (index.html)
//
// Arma, a partir de registro.js:
//   - el riel de categorías (íconos de la izquierda)
//   - el menú con los grupos desplegables de la categoría activa
//   - la navegación entre vistas, con direcciones del tipo  #/id-de-la-vista
//
// Ciclo de vida de una vista: al entrar se llama `vista.render({ senal })`; al salir se
// cancela `senal` (AbortSignal), y todo lo que la vista suscribió con ella se suelta solo.
//
// Al arrancar también enciende los cambios en vivo (sincronizar.js), que siguen funcionando
// sea cual sea la vista abierta.
//
// Secciones: 1. Arranque · 2. Riel · 3. Menú · 4. Navegación · 5. Barra superior
//            6. Compatibilidad con el generador anterior · 7. Eventos y conexión automática
// =============================================================================

import { decodificar } from '../comun.js';
import * as almacen from './almacen.js';
import * as envivo from './envivo.js';
import { CATEGORIAS, buscarVista } from './registro.js';
import * as sincronizar from './sincronizar.js';
import { el, icono } from './ui.js';

const $ = (id) => document.getElementById(id);
const VISTA_INICIAL = 'ruleta';
let controladorVista = null; // AbortController de la vista abierta


// -----------------------------------------------------------------------------
// 1. Arranque
// -----------------------------------------------------------------------------

almacen.cargar();
importarUrlVieja();
sincronizar.iniciar(); // cambios en vivo con Supabase (si está configurado)


// -----------------------------------------------------------------------------
// 2. Riel de categorías
// -----------------------------------------------------------------------------

function pintarRiel(categoriaActiva) {
  $('riel').replaceChildren(...CATEGORIAS.map((categoria) => {
    const activa = categoria === categoriaActiva;
    return el('a', {
      href: `#/${categoria.grupos[0].vistas[0].id}`, // cada categoría abre su primera vista
      class: activa ? 'activo' : '',
      'aria-current': activa ? 'page' : null,
    }, el('span', { class: 'icono' }, icono(categoria.icono)), categoria.corto);
  }));
}


// -----------------------------------------------------------------------------
// 3. Menú: grupos desplegables de la categoría activa
// -----------------------------------------------------------------------------

function grupoDelMenu(grupo, vistaActiva) {
  const abierto = !almacen.menuCerrados().includes(grupo.id);
  const sub = el('div', { class: 'sub', id: `sub-${grupo.id}`, hidden: !abierto },
    ...grupo.vistas.map((vista) => el('a', {
      href: `#/${vista.id}`,
      'aria-current': vista === vistaActiva ? 'page' : null,
    }, vista.titulo)));

  const boton = el('button', {
    class: 'grupo-titulo',
    'aria-expanded': String(abierto),
    'aria-controls': sub.id,
    onclick: () => {
      const ahoraAbierto = boton.getAttribute('aria-expanded') !== 'true';
      boton.setAttribute('aria-expanded', String(ahoraAbierto));
      sub.hidden = !ahoraAbierto;
      almacen.cambiarGrupoMenu(grupo.id, ahoraAbierto);
    },
  }, grupo.titulo, icono('flecha'));

  const contieneActiva = grupo.vistas.includes(vistaActiva);
  return el('div', { class: contieneActiva ? 'grupo activo' : 'grupo' }, boton, sub);
}

function pintarMenu(categoria, vistaActiva) {
  $('menu').replaceChildren(
    el('div', { class: 'menu-titulo' }, categoria.titulo),
    ...categoria.grupos.map((grupo) => grupoDelMenu(grupo, vistaActiva)),
    el('p', { class: 'nota-menu' },
      'Las URLs funcionan en ', el('b', {}, 'OBS (Fuente de navegador)'), ' y en ', el('b', {}, 'LIVE Studio (Enlace)'), '.'));
}


// -----------------------------------------------------------------------------
// 4. Navegación
// -----------------------------------------------------------------------------

function navegar() {
  const id = location.hash.startsWith('#/') ? location.hash.slice(2) : VISTA_INICIAL;
  const { categoria, grupo, vista } = buscarVista(id) || buscarVista(VISTA_INICIAL);

  // Se cierra la vista anterior: sus suscripciones y oyentes se sueltan aquí.
  controladorVista?.abort();
  controladorVista = new AbortController();

  pintarRiel(categoria);
  pintarMenu(categoria, vista);
  $('ruta').replaceChildren(
    icono(categoria.icono),
    el('span', {}, categoria.titulo), el('span', {}, '/'),
    el('span', {}, grupo.titulo), el('span', {}, '/'),
    el('strong', {}, vista.titulo));
  document.title = `${vista.titulo} — Live Tools`;

  $('contenido').replaceChildren(
    el('h1', { class: 'vista-titulo' }, vista.titulo),
    el('p', { class: 'intro' }, vista.descripcion || ''),
    el('div', { class: 'rejilla' }, ...vista.render({ senal: controladorVista.signal })));

  document.body.classList.remove('menu-abierto');
  scrollTo(0, 0);
}


// -----------------------------------------------------------------------------
// 5. Barra superior: cuenta y estado LIVE
// -----------------------------------------------------------------------------

function pintarCuenta() {
  const { usuario, clave } = almacen.conexion();
  const { conectado, mensaje } = envivo.estado;
  $('nombreUsuario').textContent = usuario || 'Sin cuenta';
  $('avatar').textContent = usuario ? usuario[0].toUpperCase() : '?';
  $('subUsuario').textContent = conectado ? 'LIVE' : usuario ? (clave ? 'listo' : 'falta la clave') : 'configura la conexión';
  $('pastillaLive').classList.toggle('ok', conectado);
  $('pastillaLive').title = mensaje;
}


// -----------------------------------------------------------------------------
// 6. Compatibilidad: URL del generador anterior (index.html#c=…)
// -----------------------------------------------------------------------------
// Si alguien abre el panel con una URL vieja, su configuración pasa a la ruleta.

function importarUrlVieja() {
  const c = new URLSearchParams(location.hash.slice(1)).get('c');
  if (!c) return;
  try {
    const cfg = decodificar(c);
    const con = almacen.conexion();
    if (cfg.u) con.usuario = cfg.u;
    if (cfg.k) con.clave = cfg.k;
    const ruleta = almacen.widget('ruleta');
    Object.assign(ruleta, {
      giftId: cfg.g ?? ruleta.giftId,
      regalo: cfg.r ?? ruleta.regalo,
      gpr: cfg.gpr ?? ruleta.gpr,
      max: cfg.max ?? ruleta.max,
      ...(Array.isArray(cfg.p) && cfg.p.length ? { premios: cfg.p.map(([texto, peso]) => ({ texto, peso })) } : {}),
    });
    almacen.guardar();
  } catch {
    // URL dañada: se ignora y el panel abre normal.
  }
  history.replaceState(null, '', `${location.pathname}${location.search}#/ruleta`);
}


// -----------------------------------------------------------------------------
// 7. Eventos globales y conexión automática
// -----------------------------------------------------------------------------

$('btnMenu').addEventListener('click', () => document.body.classList.toggle('menu-abierto'));
addEventListener('hashchange', navegar);
almacen.alCambiar(pintarCuenta);
envivo.alCambiar((cambio) => { if (cambio.estado) pintarCuenta(); });

pintarCuenta();
navegar();

// Con la conexión automática, cada vez que se abre el panel se conecta solo al LIVE: así el
// catálogo de regalos sigue creciendo en cada transmisión sin acordarse de pulsar nada.
// Si la cuenta aún no está en vivo, reintenta cada minuto hasta que lo esté.
const { usuario, clave } = almacen.conexion();
if (almacen.preferencias().autoConectar && usuario && clave) envivo.conectar();
