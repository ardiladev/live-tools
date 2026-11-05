// =============================================================================
// vistas/regalos.js — Actividad → Regalos → Buscador de regalos
//
// Catálogo permanente con cada regalo que llega al LIVE (y los que se agreguen a mano),
// para saber su ID y usarlo en los widgets. Los datos viven en almacen.js; aquí solo se
// muestran y se editan.
// Secciones: 1. Orden y formato · 2. Vista (conexión · avisos de código · tabla · formulario)
// =============================================================================

import { nubeActiva } from '../../nube.js';
import * as almacen from '../almacen.js';
import * as envivo from '../envivo.js';
import { el, tarjeta, campo, casilla, nota, numero, crearAviso } from '../ui.js';


// -----------------------------------------------------------------------------
// 1. Orden y formato
// -----------------------------------------------------------------------------

const nombreDe = almacen.nombreRegalo;

// Con cambios en vivo (Supabase) la ruleta en OBS se entera sola; sin ellos hay que recopiar su URL.
const despuesDeCambiarRuleta = () => (nubeActiva()
  ? 'el cambio llega solo a la ruleta en OBS'
  : 'vuelve a copiar su URL para OBS');

// Avisos viejos guardaban `enRuleta: true` (solo existía una ruleta); los nuevos, los títulos.
const enRuletas = (cambio) => (Array.isArray(cambio.enRuleta)
  ? cambio.enRuleta
  : (cambio.enRuleta ? ['Ruleta de regalos'] : []));

const ORDENES = {
  recientes: (a, b) => (b.ultimo || 0) - (a.ultimo || 0),
  veces: (a, b) => (b.veces || 0) - (a.veces || 0),
  monedas: (a, b) => (b.diamantes || 0) - (a.diamantes || 0),
  nombre: (a, b) => nombreDe(a).localeCompare(nombreDe(b), 'es'),
};
const OPCIONES_ORDEN = [['recientes', 'Más recientes'], ['veces', 'Más enviados'], ['monedas', 'Más caros'], ['nombre', 'Nombre']];

const fecha = (ms) => (ms
  ? new Date(ms).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  : '—');

const INTERVALO_REPINTADO_MS = 300;

// Búsqueda y orden se recuerdan mientras la página esté abierta.
let busqueda = '';
let orden = 'recientes';


// -----------------------------------------------------------------------------
// 2. Vista
// -----------------------------------------------------------------------------

export default {
  id: 'regalos',
  titulo: 'Buscador de regalos',
  descripcion: 'Cada regalo que te envían queda guardado aquí con su ID. Si TikTok manda su nombre (en inglés), queda puesto; puedes cambiarlo por el que quieras.',

  render({ senal }) {
    const cuerpoTabla = el('tbody');
    const resumen = el('span', { class: 'nota sin-margen' });
    const aviso = el('div', { class: 'aviso', role: 'status' });
    const avisar = crearAviso(aviso, 4000);
    const estadoConexion = el('div', { class: 'estado' });
    const botonConectar = el('button', { onclick: () => (envivo.activa() ? envivo.desconectar() : envivo.conectar()) });
    const avisosCodigo = el('div', { class: 'avisos-codigo' });

    // ---------- Acciones de cada regalo ----------
    async function copiar(giftId) {
      try {
        await navigator.clipboard.writeText(giftId);
        avisar(`ID ${giftId} copiado.`);
      } catch {
        avisar(`El ID es ${giftId}.`);
      }
    }

    // id: 'ruleta' (la normal) o 'ruleta-premium' (ver almacen.RULETAS).
    function usarEnRuleta(regalo, id) {
      const ruleta = almacen.widget(id);
      ruleta.giftId = regalo.giftId;
      if (nombreDe(regalo)) ruleta.regalo = `${nombreDe(regalo)} 🎁`;
      almacen.guardar();
      location.hash = `#/${id}`;
    }

    // ---------- Tabla ----------
    /**
     * El campo muestra el nombre propio o, si no hay, el que mandó TikTok (en inglés), así el
     * regalo queda nombrado desde que llega. Escribir otro lo cambia; dejar el de TikTok (o
     * borrar el campo) vuelve al de TikTok, que se sigue actualizando si TikTok lo cambia.
     */
    function cambiarNombre(r, texto) {
      const propio = texto === r.nombre ? '' : texto;
      if (propio !== (r.nombrePropio || '')) almacen.nombrarRegalo(r.giftId, propio);
    }

    function filaRegalo(r) {
      const nombre = el('input', {
        value: nombreDe(r),
        placeholder: 'Escribe un nombre…',
        maxLength: 40,
        title: r.nombre ? `Nombre en TikTok: ${r.nombre}` : 'TikTok no mandó el nombre de este regalo',
        'aria-label': `Nombre del regalo ${r.giftId}`,
        onchange: (e) => cambiarNombre(r, e.target.value.trim()),
      });
      // Si la persona le puso otro nombre, se recuerda el original de TikTok debajo.
      const original = r.nombrePropio && r.nombre && r.nombrePropio !== r.nombre
        ? el('div', { class: 'hora' }, `TikTok: ${r.nombre}`)
        : null;
      const anteriores = r.idsAnteriores?.length
        ? el('div', { class: 'hora', title: 'Códigos que tuvo antes este regalo' }, `antes: ${r.idsAnteriores.join(', ')}`)
        : null;

      return el('tr', {},
        el('td', { class: 'celda-icono' }, r.imagen ? el('img', { class: 'icono-regalo grande', src: r.imagen, alt: '' }) : el('span', { 'aria-hidden': 'true' }, '🎁')),
        el('td', { class: 'celda-nombre' }, nombre, original),
        el('td', {}, el('code', {}, r.giftId), anteriores),
        el('td', {}, r.diamantes ? numero(r.diamantes) : '—'),
        el('td', {}, numero(r.veces || 0)),
        el('td', { class: 'hora sin-salto' }, fecha(r.ultimo)),
        el('td', { class: 'sin-salto' },
          el('button', { onclick: () => copiar(r.giftId), title: 'Copiar el ID' }, 'Copiar ID'), ' ',
          el('button', { class: 'principal', onclick: () => usarEnRuleta(r, 'ruleta'), title: 'Poner este regalo en la ruleta de regalos normal' }, 'Usar en ruleta'), ' ',
          el('button', { class: 'principal', onclick: () => usarEnRuleta(r, 'ruleta-premium'), title: 'Poner este regalo en la ruleta premium' }, 'Usar en premium'), ' ',
          el('button', { onclick: () => almacen.quitarRegalo(r.giftId), title: 'Quitar del catálogo', 'aria-label': `Quitar ${r.giftId}` }, '✕')));
    }

    function pintarTabla() {
      const todos = Object.values(almacen.regalos());
      const q = busqueda.trim().toLowerCase();
      const visibles = todos
        .filter((r) => !q || r.giftId.includes(q) || nombreDe(r).toLowerCase().includes(q))
        .sort(ORDENES[orden]);
      resumen.textContent = `${visibles.length} de ${todos.length} regalos`;

      if (visibles.length) {
        cuerpoTabla.replaceChildren(...visibles.map(filaRegalo));
        return;
      }
      const vacio = todos.length
        ? 'Ningún regalo coincide con la búsqueda.'
        : 'Todavía no hay regalos. Conéctate al LIVE con el botón de arriba y pide que te envíen uno, o agrégalo a mano.';
      cuerpoTabla.replaceChildren(el('tr', {}, el('td', { colSpan: 7, class: 'vacio' }, vacio)));
    }

    // ---------- Avisos de cambio de código ----------
    const describir = (id) => {
      const r = almacen.regalos()[id];
      return `${id}${r?.diamantes ? ` · ${numero(r.diamantes)} monedas` : ''} · ${numero(r?.veces || 0)} veces`;
    };

    function pregunta(sugerencia) {
      const nombre = nombreDe(almacen.regalos()[sugerencia.viejo]) || nombreDe(almacen.regalos()[sugerencia.nuevo]);
      return el('div', { class: 'aviso-codigo pregunta' },
        el('p', {}, el('b', {}, `¿“${nombre}” cambió de código?`)),
        el('p', { class: 'nota' }, `Antes: ${describir(sugerencia.viejo)}  →  Ahora: ${describir(sugerencia.nuevo)}`),
        el('div', { class: 'fila-acciones' },
          el('button', { class: 'principal', onclick: () => almacen.responderSugerencia(sugerencia, true) }, `Sí, reemplazar por ${sugerencia.nuevo}`),
          el('button', { onclick: () => almacen.responderSugerencia(sugerencia, false) }, 'No, son regalos distintos')));
    }

    function cambiosHechos(cambios) {
      return el('div', { class: 'aviso-codigo' },
        el('p', {}, el('b', {}, 'Códigos actualizados')),
        el('ul', {}, ...cambios.map((c) =>
          el('li', {}, `${c.nombre || 'Regalo'}: ${c.viejo} → ${c.nuevo}`,
            enRuletas(c).length ? el('b', { class: 'texto-alerta' }, ` · se actualizó en ${enRuletas(c).join(' y ')}: ${despuesDeCambiarRuleta()}`) : null))),
        el('button', { onclick: () => almacen.olvidarCambiosDeCodigo() }, 'Entendido'));
    }

    function pintarAvisosCodigo() {
      const cambios = almacen.cambiosDeCodigo();
      avisosCodigo.replaceChildren(
        ...almacen.sugerencias().map(pregunta),
        ...(cambios.length ? [cambiosHechos(cambios)] : []));
    }

    // ---------- Conexión ----------
    function pintarConexion() {
      estadoConexion.replaceChildren(
        el('span', { class: envivo.estado.conectado ? 'punto ok' : 'punto' }),
        el('span', {}, envivo.estado.mensaje));
      botonConectar.textContent = envivo.activa() ? 'Desconectar' : 'Conectar al LIVE';
      botonConectar.className = envivo.activa() ? '' : 'principal';
    }

    function pintarTodo() {
      pintarConexion();
      pintarAvisosCodigo();
      // Repintar la tabla mientras alguien escribe un nombre le quitaría el foco: se espera.
      if (!cuerpoTabla.contains(document.activeElement)) pintarTabla();
    }

    // ---------- Actualización en vivo ----------
    let pendiente = false;
    const repintar = () => {
      if (pendiente) return;
      pendiente = true;
      setTimeout(() => {
        pendiente = false;
        if (!senal.aborted) pintarTodo();
      }, INTERVALO_REPINTADO_MS);
    };
    envivo.alCambiar(repintar, senal);
    almacen.alCambiar(repintar, senal);
    // Al terminar de editar un nombre, se aplica lo que quedó pendiente.
    cuerpoTabla.addEventListener('focusout', () => setTimeout(repintar, 0));

    // ---------- Formulario: agregar a mano ----------
    let nuevoId = '';
    let nuevoNombre = '';
    function agregarAMano(e) {
      e.preventDefault();
      const id = nuevoId.replace(/\D/g, '');
      if (!id) return avisar('Escribe el ID (solo números).');
      if (!almacen.regalos()[id]) almacen.anotarRegalo(id, { ultimo: Date.now() });
      almacen.nombrarRegalo(id, nuevoNombre.trim());
      e.target.reset();
      nuevoId = '';
      nuevoNombre = '';
      avisar(`Regalo ${id} agregado.`);
    }

    function cambiarAutoConectar(marcada) {
      almacen.preferencias().autoConectar = marcada;
      almacen.guardar();
      if (marcada && !envivo.activa()) envivo.conectar();
    }

    pintarConexion();
    pintarAvisosCodigo();
    pintarTabla();

    // ---------- Estructura ----------
    return [
      tarjeta('Regalos guardados', { ancha: true },
        el('div', { class: 'fila-acciones' }, botonConectar, estadoConexion),
        casilla('Conectar automáticamente cada vez que abra el panel', {
          marcada: almacen.preferencias().autoConectar,
          alCambiar: cambiarAutoConectar,
        }),
        avisosCodigo,
        el('div', { class: 'campos separado-abajo' },
          campo('Buscar por nombre o ID:', { valor: busqueda, placeholder: 'ej. capibara o 17490', alCambiar: (v) => { busqueda = v; pintarTabla(); } }),
          campo('Ordenar por:', { tipo: 'select', valor: orden, opciones: OPCIONES_ORDEN, alCambiar: (v) => { orden = v; pintarTabla(); } })),
        el('div', { class: 'fila-entre' }, resumen, aviso),
        el('div', { class: 'contenedor-tabla' },
          el('table', { class: 'tabla' },
            el('thead', {}, el('tr', {},
              el('th', {}, ''), el('th', {}, 'Nombre'), el('th', {}, 'ID'), el('th', {}, 'Monedas'),
              el('th', {}, 'Veces'), el('th', {}, 'Último'), el('th', {}, ''))),
            cuerpoTabla)),
        nota('La lista se guarda en este navegador y continúa en cada LIVE, pero solo anota regalos mientras el panel está abierto y conectado. ',
          'Si un regalo llega con un código nuevo, se reescribe solo cuando TikTok manda su nombre y su precio; si no, te lo preguntamos aquí arriba. ',
          `“Usar en ruleta” y “Usar en premium” cambian el regalo de la ruleta normal o de la premium: ${despuesDeCambiarRuleta()}.`)),

      tarjeta('Agregar un regalo a mano', { ancha: true },
        el('form', { class: 'campos formulario-en-linea', onsubmit: agregarAMano },
          campo('ID del regalo:', { inputMode: 'numeric', placeholder: 'ej. 5655', alCambiar: (v) => { nuevoId = v; } }),
          campo('Nombre:', { placeholder: 'ej. Rosa', maxLength: 40, alCambiar: (v) => { nuevoNombre = v; } }),
          el('button', { type: 'submit' }, '+ Agregar')),
        nota('Útil para regalos que todavía no te han enviado: por ejemplo, un ID que viste en el navegador de regalos de TikFinity.')),
    ];
  },
};
