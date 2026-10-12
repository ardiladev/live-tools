// Actividad → Regalos → Buscador de regalos
// Catálogo propio con cada regalo que llega al LIVE (y los que se agreguen a mano),
// para saber su ID y usarlo en los widgets.

import * as almacen from '../almacen.js';
import * as envivo from '../envivo.js';
import { el, tarjeta, campo, casilla, nota, numero } from '../ui.js';

const ORDENES = {
  recientes: (a, b) => (b.ultimo || 0) - (a.ultimo || 0),
  veces: (a, b) => (b.veces || 0) - (a.veces || 0),
  monedas: (a, b) => (b.diamantes || 0) - (a.diamantes || 0),
  nombre: (a, b) => nombreDe(a).localeCompare(nombreDe(b), 'es'),
};
const nombreDe = almacen.nombreRegalo;
const fecha = (ms) => (ms ? new Date(ms).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

// Se recuerdan mientras la página esté abierta.
let busqueda = '';
let orden = 'recientes';

export default {
  id: 'regalos',
  titulo: 'Buscador de regalos',
  descripcion: 'Cada regalo que te envían queda guardado aquí con su ID. TikTok casi nunca manda el nombre: escríbelo tú para encontrarlo después.',

  render() {
    const cuerpo = el('tbody');
    const resumen = el('span', { class: 'nota', style: 'margin:0' });
    const aviso = el('div', { class: 'aviso', role: 'status' });
    const estadoConexion = el('div', { class: 'estado' });
    const botonConectar = el('button', { onclick: () => (envivo.activa() ? envivo.desconectar() : envivo.conectar()) });

    function avisar(texto) {
      aviso.textContent = texto;
      clearTimeout(avisar.t);
      avisar.t = setTimeout(() => { aviso.textContent = ''; }, 4000);
    }

    async function copiar(texto) {
      try { await navigator.clipboard.writeText(texto); avisar(`ID ${texto} copiado.`); }
      catch { avisar(`El ID es ${texto}.`); }
    }

    function usarEnRuleta(r) {
      const cfg = almacen.widget('ruleta', {});
      cfg.giftId = r.giftId;
      if (nombreDe(r)) cfg.regalo = `${nombreDe(r)} 🎁`;
      almacen.guardar();
      location.hash = '#/ruleta';
    }

    function fila(r) {
      const nombre = el('input', {
        value: r.nombrePropio || '',
        placeholder: r.nombre || 'Escribe un nombre…',
        maxLength: 40,
        'aria-label': `Nombre del regalo ${r.giftId}`,
        onchange: (e) => almacen.nombrarRegalo(r.giftId, e.target.value.trim()),
      });
      const anteriores = r.idsAnteriores?.length
        ? el('div', { class: 'hora', title: 'Códigos que tuvo antes este regalo' }, 'antes: ', r.idsAnteriores.join(', '))
        : null;
      return el('tr', {},
        el('td', { style: 'width:40px' }, r.imagen ? el('img', { src: r.imagen, alt: '', width: 32, height: 32 }) : el('span', { 'aria-hidden': 'true' }, '🎁')),
        el('td', { style: 'min-width:160px' }, nombre),
        el('td', {}, el('code', {}, r.giftId), anteriores),
        el('td', {}, r.diamantes ? numero(r.diamantes) : '—'),
        el('td', {}, numero(r.veces || 0)),
        el('td', { class: 'hora', style: 'white-space:nowrap' }, fecha(r.ultimo)),
        el('td', { style: 'white-space:nowrap' },
          el('button', { onclick: () => copiar(r.giftId), title: 'Copiar el ID' }, 'Copiar ID'), ' ',
          el('button', { class: 'principal', onclick: () => usarEnRuleta(r), title: 'Poner este regalo en la ruleta' }, 'Usar en la ruleta'), ' ',
          el('button', { onclick: () => almacen.quitarRegalo(r.giftId), title: 'Quitar del catálogo', 'aria-label': `Quitar ${r.giftId}` }, '✕')));
    }

    // ---------- Cambios de código: los hechos y los que hay que confirmar ----------
    const avisosCodigo = el('div');
    const describir = (id) => {
      const r = almacen.regalos()[id];
      return `${id}${r?.diamantes ? ` · ${numero(r.diamantes)} monedas` : ''} · ${numero(r?.veces || 0)} veces`;
    };

    function pintarAvisosCodigo() {
      const preguntas = almacen.sugerencias().map((s) => {
        const nombre = nombreDe(almacen.regalos()[s.viejo]) || nombreDe(almacen.regalos()[s.nuevo]);
        return el('div', { class: 'opciones', style: 'display:block;border-color:var(--acento)' },
          el('p', { style: 'margin:0 0 4px' }, el('b', {}, `¿“${nombre}” cambió de código?`)),
          el('p', { class: 'nota', style: 'margin:0 0 8px' }, `Antes: ${describir(s.viejo)}  →  Ahora: ${describir(s.nuevo)}`),
          el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' },
            el('button', { class: 'principal', onclick: () => almacen.responderSugerencia(s, true) }, `Sí, reemplazar por ${s.nuevo}`),
            el('button', { onclick: () => almacen.responderSugerencia(s, false) }, 'No, son regalos distintos')));
      });
      const cambios = almacen.cambiosDeCodigo();
      const hechos = cambios.length
        ? el('div', { class: 'opciones', style: 'display:block' },
            el('p', { style: 'margin:0 0 6px' }, el('b', {}, 'Códigos actualizados')),
            el('ul', { style: 'margin:0 0 8px;padding-left:18px' }, ...cambios.map((c) =>
              el('li', {}, `${c.nombre || 'Regalo'}: ${c.viejo} → ${c.nuevo}`,
                c.enRuleta ? el('b', { style: 'color:var(--mal)' }, ' · la ruleta se actualizó: vuelve a copiar su URL para OBS') : null))),
            el('button', { onclick: () => almacen.olvidarCambiosDeCodigo() }, 'Entendido'))
        : null;
      avisosCodigo.replaceChildren(...preguntas, hechos || '');
    }

    function pintar() {
      pintarAvisosCodigo();
      const todos = Object.values(almacen.regalos());
      const q = busqueda.trim().toLowerCase();
      const visibles = todos
        .filter((r) => !q || r.giftId.includes(q) || nombreDe(r).toLowerCase().includes(q))
        .sort(ORDENES[orden]);
      resumen.textContent = `${visibles.length} de ${todos.length} regalos`;
      cuerpo.replaceChildren(...(visibles.length
        ? visibles.map(fila)
        : [el('tr', {}, el('td', { colSpan: 7, class: 'vacio' }, todos.length
            ? 'Ningún regalo coincide con la búsqueda.'
            : 'Todavía no hay regalos. Conéctate al LIVE con el botón de arriba y pide que te envíen uno, o agrégalo a mano.'))]));
    }

    function pintarConexion() {
      estadoConexion.replaceChildren(el('span', { class: 'punto' + (envivo.estado.conectado ? ' ok' : '') }), el('span', {}, envivo.estado.mensaje));
      botonConectar.textContent = envivo.activa() ? 'Desconectar' : 'Conectar al LIVE';
      botonConectar.className = envivo.activa() ? '' : 'principal';
    }

    // Repintar la tabla mientras alguien escribe un nombre le quitaría el foco: se espera a que termine.
    const editando = () => cuerpo.contains(document.activeElement);
    cuerpo.addEventListener('focusout', () => setTimeout(() => { if (!editando()) pintar(); }, 0));

    let pendiente = false;
    const repintar = () => {
      if (pendiente) return;
      pendiente = true;
      setTimeout(() => { pendiente = false; pintarConexion(); if (!editando()) pintar(); }, 300);
    };
    const dejarEnvivo = envivo.alCambiar(() => { if (!cuerpo.isConnected) return dejarEnvivo(); repintar(); });
    const dejarAlmacen = almacen.alCambiar(() => { if (!cuerpo.isConnected) return dejarAlmacen(); repintar(); });

    // ---------- Agregar a mano ----------
    let nuevoId = '';
    let nuevoNombre = '';
    const formulario = el('form', {
      class: 'campos',
      style: 'align-items:end',
      onsubmit: (e) => {
        e.preventDefault();
        const id = nuevoId.replace(/\D/g, '');
        if (!id) return avisar('Escribe el ID (solo números).');
        if (!almacen.regalos()[id]) almacen.anotarRegalo(id, { ultimo: Date.now() });
        almacen.nombrarRegalo(id, nuevoNombre.trim());
        e.target.reset();
        nuevoId = nuevoNombre = '';
        avisar(`Regalo ${id} agregado.`);
      },
    },
      campo('ID del regalo:', { inputMode: 'numeric', placeholder: 'ej. 5655', alCambiar: (v) => { nuevoId = v; } }),
      campo('Nombre:', { placeholder: 'ej. Rosa', maxLength: 40, alCambiar: (v) => { nuevoNombre = v; } }),
      el('button', { type: 'submit' }, '+ Agregar'));

    pintarConexion();
    pintar();

    return [
      tarjeta('Regalos guardados', { ancha: true },
        el('div', { style: 'display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:8px' },
          botonConectar, estadoConexion),
        casilla('Conectar automáticamente cada vez que abra el panel', {
          marcada: almacen.preferencias().autoConectar,
          alCambiar: (v) => {
            almacen.preferencias().autoConectar = v;
            almacen.guardar();
            if (v && !envivo.activa()) envivo.conectar();
          },
        }),
        el('div', { style: 'margin:12px 0 4px' }, avisosCodigo),
        el('div', { class: 'campos', style: 'margin-bottom:8px' },
          campo('Buscar por nombre o ID:', { valor: busqueda, placeholder: 'ej. capibara o 17490', alCambiar: (v) => { busqueda = v; pintar(); } }),
          campo('Ordenar por:', {
            tipo: 'select', valor: orden,
            opciones: [['recientes', 'Más recientes'], ['veces', 'Más enviados'], ['monedas', 'Más caros'], ['nombre', 'Nombre']],
            alCambiar: (v) => { orden = v; pintar(); },
          })),
        el('div', { style: 'display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap' }, resumen, aviso),
        el('div', { class: 'contenedor-tabla', style: 'margin-top:6px' },
          el('table', { class: 'tabla' },
            el('thead', {}, el('tr', {},
              el('th', {}, ''), el('th', {}, 'Nombre'), el('th', {}, 'ID'), el('th', {}, 'Monedas'),
              el('th', {}, 'Veces'), el('th', {}, 'Último'), el('th', {}, ''))),
            cuerpo)),
        nota('La lista se guarda en este navegador y continúa en cada LIVE, pero solo anota regalos mientras el panel está abierto y conectado. ',
          'Si un regalo llega con un código nuevo, se reescribe solo cuando TikTok manda su nombre y su precio; si no, te lo preguntamos aquí arriba. ',
          '“Usar en la ruleta” cambia el regalo de la ruleta: después vuelve a copiar su URL para OBS.')),
      tarjeta('Agregar un regalo a mano', { ancha: true },
        formulario,
        nota('Útil para regalos que todavía no te han enviado: por ejemplo, un ID que viste en el navegador de regalos de TikFinity.')),
    ];
  },
};
