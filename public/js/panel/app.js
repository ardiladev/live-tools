// Arranque del panel: arma el riel de categorías, el menú desplegable y la navegación
// entre vistas (#/id-de-la-vista), a partir de registro.js.

import { decodificar } from '../comun.js';
import * as almacen from './almacen.js';
import * as envivo from './envivo.js';
import { CATEGORIAS, buscarVista } from './registro.js';
import { el, icono } from './ui.js';

const $ = (id) => document.getElementById(id);
const VISTA_INICIAL = 'ruleta';

almacen.cargar();
importarUrlVieja();

// ---------- Riel de categorías ----------
function pintarRiel(categoriaActiva) {
  $('riel').replaceChildren(...CATEGORIAS.map((c) =>
    el('a', { href: `#/${c.grupos[0].vistas[0].id}`, class: c.id === categoriaActiva.id ? 'activo' : '', 'aria-current': c.id === categoriaActiva.id ? 'page' : null },
      el('span', { class: 'icono' }, icono(c.icono)), c.corto)));
}

// ---------- Menú: grupos desplegables de la categoría activa ----------
function pintarMenu(categoria, vistaActiva) {
  const cerrados = almacen.obtener().menuCerrados;
  const grupos = categoria.grupos.map((g) => {
    const abierto = !cerrados.includes(g.id);
    const sub = el('div', { class: 'sub', id: `sub-${g.id}`, hidden: !abierto },
      ...g.vistas.map((v) => el('a', { href: `#/${v.id}`, 'aria-current': v.id === vistaActiva.id ? 'page' : null,
        style: v.id === vistaActiva.id ? 'color:var(--texto);font-weight:600' : null }, v.titulo)));
    const boton = el('button', {
      class: 'grupo-titulo', 'aria-expanded': String(abierto), 'aria-controls': `sub-${g.id}`,
      onclick: () => {
        const ahora = boton.getAttribute('aria-expanded') !== 'true';
        boton.setAttribute('aria-expanded', String(ahora));
        sub.hidden = !ahora;
        const lista = almacen.obtener().menuCerrados.filter((x) => x !== g.id);
        if (!ahora) lista.push(g.id);
        almacen.obtener().menuCerrados = lista;
        almacen.guardar();
      },
    }, g.titulo, icono('flecha'));
    const contieneActiva = g.vistas.some((v) => v.id === vistaActiva.id);
    return el('div', { class: 'grupo' + (contieneActiva ? ' activo' : '') }, boton, sub);
  });
  $('menu').replaceChildren(
    el('div', { style: 'padding:2px 10px 10px;color:var(--suave);font-size:12px;text-transform:uppercase;letter-spacing:.04em' }, categoria.titulo),
    ...grupos,
    el('p', { class: 'nota-menu', html: 'Las URLs funcionan en <b>OBS (Fuente de navegador)</b> y en <b>LIVE Studio (Enlace)</b>.' }));
}

// ---------- Navegación ----------
function navegar() {
  const id = location.hash.startsWith('#/') ? location.hash.slice(2) : VISTA_INICIAL;
  const encontrada = buscarVista(id) || buscarVista(VISTA_INICIAL);
  const { categoria, grupo, vista } = encontrada;

  pintarRiel(categoria);
  pintarMenu(categoria, vista);
  $('ruta').replaceChildren(icono(CATEGORIAS.find((c) => c === categoria).icono),
    el('span', {}, categoria.titulo), el('span', {}, '/'), el('span', {}, grupo.titulo), el('span', {}, '/'), el('strong', {}, vista.titulo));
  document.title = `${vista.titulo} — Panel LIVE`;

  $('contenido').replaceChildren(
    el('h1', { class: 'vista-titulo' }, vista.titulo),
    el('p', { class: 'intro' }, vista.descripcion || ''),
    el('div', { class: 'rejilla' }, ...vista.render()));
  document.body.classList.remove('menu-abierto');
  scrollTo(0, 0);
}

// ---------- Barra superior ----------
function pintarCuenta() {
  const { usuario, clave } = almacen.conexion();
  $('nombreUsuario').textContent = usuario || 'Sin cuenta';
  $('avatar').textContent = usuario ? usuario[0].toUpperCase() : '?';
  $('subUsuario').textContent = envivo.estado.conectado ? 'LIVE' : usuario ? (clave ? 'listo' : 'falta la clave') : 'configura la conexión';
  $('pastillaLive').classList.toggle('ok', envivo.estado.conectado);
  $('pastillaLive').title = envivo.estado.mensaje;
}

// Una URL del generador anterior (index.html#c=…) se convierte en la config de la ruleta.
function importarUrlVieja() {
  const c = new URLSearchParams(location.hash.slice(1)).get('c');
  if (!c) return;
  try {
    const cfg = decodificar(c);
    const con = almacen.conexion();
    if (cfg.u) con.usuario = cfg.u;
    if (cfg.k) con.clave = cfg.k;
    const ruleta = almacen.widget('ruleta', {});
    Object.assign(ruleta, {
      giftId: cfg.g ?? ruleta.giftId, regalo: cfg.r ?? ruleta.regalo, gpr: cfg.gpr ?? ruleta.gpr, max: cfg.max ?? ruleta.max,
      ...(Array.isArray(cfg.p) && cfg.p.length ? { premios: cfg.p.map(([texto, peso]) => ({ texto, peso })) } : {}),
    });
    almacen.guardar();
  } catch { /* URL dañada: se ignora */ }
  history.replaceState(null, '', location.pathname + location.search + '#/ruleta');
}

$('btnMenu').onclick = () => document.body.classList.toggle('menu-abierto');
addEventListener('hashchange', navegar);
almacen.alCambiar(pintarCuenta);
envivo.alCambiar((cambio) => { if (cambio.estado) pintarCuenta(); });

pintarCuenta();
navegar();
