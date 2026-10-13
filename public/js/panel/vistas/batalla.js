// =============================================================================
// vistas/batalla.js — Juegos → Competencias → Batalla de regalos
//
// Configura el widget batalla.html, un tira y afloja entre dos equipos: cada uno con su
// nombre, regalo, monedas por regalo (si TikTok no manda el precio), color y foto opcional.
// "Reiniciar batalla" cambia la ronda (`ro`) y la sube a Supabase al instante: el widget
// pone los puntos en 0. Ver js/widgets/batalla.js para las claves.
// Secciones: 1. Valores por defecto · 2. Configuración del widget · 3. Vista
// =============================================================================

import * as almacen from '../almacen.js';
import { editorEstilo } from '../estilo.js';
import * as sincronizar from '../sincronizar.js';
import { el, tarjeta, tarjetaWidget, campo, casilla, nota, crearAviso } from '../ui.js';


// -----------------------------------------------------------------------------
// 1. Valores por defecto
// -----------------------------------------------------------------------------

const ID = 'batalla';
const MAX_NOMBRE = 24;
const LETRAS = ['A', 'B'];

const POR_DEFECTO = {
  sonido: true,
  ronda: 0, // cambia al reiniciar: el widget pone los puntos en 0
  equipos: [
    { nombre: 'Equipo A', giftId: '5655', regalo: 'Rose', valor: 1, color: '#D4AF37', avatar: '' },
    { nombre: 'Equipo B', giftId: '5487', regalo: 'Finger Heart', valor: 5, color: '#C9CDD4', avatar: '' },
  ],
};


// -----------------------------------------------------------------------------
// 2. Configuración del widget
// -----------------------------------------------------------------------------
// Se registra al cargar, para que los cambios en vivo funcionen con o sin la vista abierta.

const ajustes = () => almacen.widget(ID, POR_DEFECTO);
const textoLimpio = (texto) => String(texto ?? '').trim();
const urlValida = (texto) => /^https?:\/\/\S+$/i.test(textoLimpio(texto));

sincronizar.registrar(ID, {
  config: () => {
    const cfg = ajustes();
    const catalogo = almacen.regalos();
    const [a, b] = cfg.equipos.map((e, i) => ({
      n: textoLimpio(e.nombre).slice(0, MAX_NOMBRE) || `Equipo ${LETRAS[i]}`,
      g: textoLimpio(e.giftId),
      v: Math.max(0, Number(e.valor) || 0),
      c: e.color,
      av: urlValida(e.avatar) ? textoLimpio(e.avatar) : '',
      img: catalogo[textoLimpio(e.giftId)]?.imagen || '', // la imagen sale del Buscador de regalos
    }));
    return { a, b, ro: cfg.ronda, s: cfg.sonido ? 1 : 0 };
  },
  // Nada bloquea el envío: si bloqueara, el reinicio tampoco llegaría a OBS. Los problemas se avisan en la vista.
});

/** Problemas de la configuración (no impiden enviarla). */
function problemas(equipos) {
  const lista = [];
  equipos.forEach((e, i) => {
    if (!textoLimpio(e.giftId)) lista.push(`El equipo ${LETRAS[i]} no tiene regalo: no sumará puntos.`);
    if (textoLimpio(e.avatar) && !urlValida(e.avatar)) lista.push(`La foto del equipo ${LETRAS[i]} tiene que ser una dirección que empiece con https://.`);
  });
  const [a, b] = equipos.map((e) => textoLimpio(e.giftId));
  if (a && a === b) lista.push(`Los dos equipos tienen el regalo ${a}: solo le sumará al equipo A.`);
  return lista;
}


// -----------------------------------------------------------------------------
// 3. Vista
// -----------------------------------------------------------------------------

export default {
  id: ID,
  titulo: 'Batalla de regalos',
  descripcion: 'Un tira y afloja entre dos equipos: cada uno tiene su regalo, y cada regalo empuja la barra hacia su lado. Ideal para batallas de baile o de equipos.',

  render({ senal }) {
    const cfg = ajustes();
    const aviso = el('div', { class: 'aviso error', role: 'status' });
    const avisoReinicio = el('div', { class: 'aviso', role: 'status' });
    const avisarReinicio = crearAviso(avisoReinicio);
    const pintarProblemas = () => { aviso.textContent = problemas(cfg.equipos).join(' '); };
    const cambio = () => {
      almacen.guardar();
      widget.actualizar();
      pintarProblemas();
    };

    // ---------- Tarjeta del widget ----------
    // Prueba: un regalo para un equipo, con su precio configurado.
    const regaloDePrueba = (i, cantidad) => (nombre) => {
      const e = ajustes().equipos[i];
      return {
        tipo: 'regalo', usuario: nombre, giftId: textoLimpio(e.giftId), nombre: textoLimpio(e.regalo),
        cantidad, diamantes: Math.max(1, Number(e.valor) || 1), imagen: '',
      };
    };

    const widget = tarjetaWidget({
      id: ID,
      titulo: 'Batalla de regalos',
      archivo: 'batalla.html',
      forma: 'horizontal',
      // El reinicio llega a la vista previa sin recargarla.
      sinRecargar: ['ro'],
      senal,
      personalizar: [
        casilla('Sonido cuando cambia quién va ganando', { marcada: cfg.sonido, alCambiar: (v) => { cfg.sonido = v; cambio(); } }),
        ...editorEstilo(ID, () => widget.actualizar()),
      ],
      pruebas: [
        { texto: 'Regalo al equipo A', evento: regaloDePrueba(0, 1) },
        { texto: 'Regalo al equipo B', evento: regaloDePrueba(1, 1) },
        { texto: 'Combo ×10 al A', evento: regaloDePrueba(0, 10) },
        { texto: 'Combo ×10 al B', evento: regaloDePrueba(1, 10) },
      ],
    });

    // ---------- Reiniciar ----------
    /** Cambia la ronda y la manda a OBS de inmediato (sin la espera habitual). */
    function reiniciar() {
      cfg.ronda = Date.now();
      almacen.guardar();
      sincronizar.subir(ID);
      widget.actualizar();
      avisarReinicio('Batalla reiniciada: los puntos de los dos equipos vuelven a 0 en OBS.');
    }

    // ---------- Equipos ----------
    function tarjetaEquipo(e, i) {
      const valor = campo('Monedas por regalo:', {
        tipo: 'number', valor: e.valor, min: 0, step: 1,
        alCambiar: (v) => { e.valor = v; cambio(); },
      });
      // Al escribir o elegir un ID del catálogo, se completan su nombre y su precio.
      const giftId = campo('ID del regalo:', {
        valor: e.giftId, inputMode: 'numeric', placeholder: 'ID',
        alCambiar: (v) => {
          e.giftId = v.trim();
          const delCatalogo = almacen.regalos()[e.giftId];
          e.regalo = delCatalogo ? almacen.nombreRegalo(delCatalogo) : '';
          if (delCatalogo?.diamantes) valor.querySelector('input').value = e.valor = delCatalogo.diamantes;
          nombreRegalo.textContent = e.regalo ? `Regalo: ${e.regalo}` : '';
          cambio();
        },
      });
      giftId.querySelector('input').setAttribute('list', 'regalos-batalla'); // `list` es de solo lectura como propiedad
      const nombreRegalo = el('p', { class: 'nota sin-margen' }, e.regalo ? `Regalo: ${e.regalo}` : '');

      return tarjeta(`Equipo ${LETRAS[i]} (${i ? 'derecha' : 'izquierda'})`, {},
        el('div', { class: 'campos' },
          campo('Nombre:', { valor: e.nombre, maxLength: MAX_NOMBRE, alCambiar: (v) => { e.nombre = v; cambio(); } }),
          giftId,
          valor,
          campo('Color:', { tipo: 'color', valor: e.color, alCambiar: (v) => { e.color = v; cambio(); } })),
        nombreRegalo,
        el('div', { class: 'campos separado-arriba' },
          campo('Foto (URL, opcional):', {
            valor: e.avatar, placeholder: 'https://…',
            alCambiar: (v) => { e.avatar = v.trim(); cambio(); },
          })),
        nota('Sin foto, se muestra la imagen del regalo (si está en el Buscador de regalos) o la inicial del nombre.'));
    }

    const regalos = Object.values(almacen.regalos()).sort((a, b) => (b.veces || 0) - (a.veces || 0));
    const datalist = el('datalist', { id: 'regalos-batalla' }, ...regalos.map((r) => el('option', {
      value: r.giftId,
      label: `${almacen.nombreRegalo(r) || 'Sin nombre'}${r.diamantes ? ` · ${r.diamantes} monedas` : ''}`,
    })));

    pintarProblemas();

    // ---------- Estructura ----------
    return [
      widget.elemento,

      tarjeta('Batalla', { ancha: true },
        el('div', { class: 'fila-acciones' },
          el('button', { class: 'principal', onclick: reiniciar, title: 'Pone los puntos de los dos equipos en 0' }, 'Reiniciar batalla')),
        avisoReinicio,
        aviso,
        nota('El reinicio llega a OBS en uno o dos segundos. Si OBS recarga la fuente, los puntos se conservan hasta que reinicies.')),

      ...[0, 1].map((i) => tarjetaEquipo(cfg.equipos[i], i)),
      datalist,

      nota('Cada regalo suma monedas × cantidad, y la barra muestra qué parte del total lleva cada equipo. TikTok no siempre manda el precio: ',
        'entonces vale lo que pongas en «Monedas por regalo». Busca los IDs en el ',
        el('a', { href: '#/regalos' }, 'Buscador de regalos'), '. Tamaño recomendado de la fuente en OBS: 1600 × 300, arriba de la escena.'),
    ];
  },
};
