// =============================================================================
// vistas/activacion.js — Juegos → Competencias → Barras de activación
//
// Configura el widget activacion.html: de 2 a 4 barras, cada una con su nombre, regalo
// activador, monedas del activador (si TikTok no manda el precio) y color. Quien envía el
// activador de una barra se une a ella y desde ahí todos sus regalos la llenan; si envía el
// de otra, se cambia. Los regalos solo suman con el reloj en marcha y al final gana la barra
// con más monedas. Iniciar/Pausar/Reiniciar cambian el reloj (`t`) o la ronda (`ro`) y se
// suben a Supabase al instante. Ver js/widgets/activacion.js para las claves.
// Se guardan siempre las 4 barras; al widget van solo las que están en juego.
// Secciones: 1. Valores por defecto · 2. Configuración del widget · 3. Vista
//            (tarjeta · reloj · barras · estructura)
// =============================================================================

import * as almacen from '../almacen.js';
import { leerReloj, iniciarReloj, pausarReloj, reiniciarReloj, formatoReloj } from '../../reloj.js';
import { editorEstilo } from '../estilo.js';
import * as sincronizar from '../sincronizar.js';
import { el, tarjeta, tarjetaWidget, campo, casilla, segmentado, nota, crearAviso } from '../ui.js';


// -----------------------------------------------------------------------------
// 1. Valores por defecto
// -----------------------------------------------------------------------------

const ID = 'activacion';
const MAX_NOMBRE = 24;
const CANTIDADES = [2, 3, 4];
const DURACION_MIN_S = 10;
const DURACION_MAX_S = 24 * 3600;

const POR_DEFECTO = {
  sonido: true,
  cantidad: 4,             // barras en juego (2, 3 o 4)
  ronda: 0,                // cambia al reiniciar: el widget pone monedas y equipos en 0
  duracion: 180,           // segundos
  reloj: { e: 'listo', fin: 0, r: 0 },
  barras: [
    { nombre: 'Rosas', giftId: '5655', regalo: 'Rose', valor: 1, color: '#D4AF37' },
    { nombre: 'Corazones', giftId: '5487', regalo: 'Finger Heart', valor: 5, color: '#C9CDD4' },
    { nombre: 'Ramos', giftId: '5780', regalo: 'Bouquet Flower', valor: 30, color: '#B87333' },
    { nombre: 'Capibaras', giftId: '17490', regalo: 'Capybara', valor: 0, color: '#8FB9A8' },
  ],
};


// -----------------------------------------------------------------------------
// 2. Configuración del widget
// -----------------------------------------------------------------------------
// Se registra al cargar, para que los cambios en vivo funcionen con o sin la vista abierta.

const ajustes = () => almacen.widget(ID, POR_DEFECTO);
const cantidad = () => (CANTIDADES.includes(ajustes().cantidad) ? ajustes().cantidad : POR_DEFECTO.cantidad);
const enJuego = () => ajustes().barras.slice(0, cantidad());
const duracion = () => Math.min(DURACION_MAX_S, Math.max(DURACION_MIN_S, Number(ajustes().duracion) || POR_DEFECTO.duracion));
const textoLimpio = (texto) => String(texto ?? '').trim();

/** Precios del Buscador de regalos { giftId: monedas }: para los regalos que TikTok manda sin precio. */
function preciosDelCatalogo() {
  const precios = {};
  for (const r of Object.values(almacen.regalos())) {
    if (r.giftId && Number(r.diamantes) > 0) precios[r.giftId] = Number(r.diamantes);
  }
  return precios;
}

sincronizar.registrar(ID, {
  config: () => {
    const cfg = ajustes();
    const catalogo = almacen.regalos();
    const eq = enJuego().map((b, i) => ({
      n: textoLimpio(b.nombre).slice(0, MAX_NOMBRE) || `Barra ${i + 1}`,
      g: textoLimpio(b.giftId),
      v: Math.max(0, Number(b.valor) || 0),
      c: b.color,
      img: catalogo[textoLimpio(b.giftId)]?.imagen || '', // la imagen sale del Buscador de regalos
    }));
    return { eq, pr: preciosDelCatalogo(), ro: cfg.ronda, s: cfg.sonido ? 1 : 0, t: { ...cfg.reloj, d: duracion() } };
  },
  // Nada bloquea el envío: si bloqueara, el reloj tampoco llegaría a OBS. Los problemas se avisan en la vista.
});

/** Problemas de la configuración (no impiden enviarla). */
function problemas() {
  const lista = [];
  const vistos = new Map();
  enJuego().forEach((b, i) => {
    const id = textoLimpio(b.giftId);
    if (!id) lista.push(`La barra ${i + 1} no tiene regalo activador: nadie podrá unirse a ella.`);
    else if (vistos.has(id)) lista.push(`Las barras ${vistos.get(id) + 1} y ${i + 1} tienen el mismo activador (${id}): solo funcionará la ${vistos.get(id) + 1}.`);
    else vistos.set(id, i);
  });
  return lista;
}


// -----------------------------------------------------------------------------
// 3. Vista
// -----------------------------------------------------------------------------

export default {
  id: ID,
  titulo: 'Barras de activación',
  descripcion: 'De 2 a 4 barras, cada una con su regalo activador: quien lo envía se une a esa barra y desde ahí todos sus regalos la llenan. Gana la barra con más monedas cuando se acaba el tiempo.',

  render({ senal }) {
    const cfg = ajustes();
    const aviso = el('div', { class: 'aviso error', role: 'status' });
    const avisoReinicio = el('div', { class: 'aviso', role: 'status' });
    const avisarReinicio = crearAviso(avisoReinicio);
    const pintarProblemas = () => { aviso.textContent = problemas().join(' '); };
    const cambio = () => {
      almacen.guardar();
      widget.actualizar();
      pintarProblemas();
    };

    // ---------- Tarjeta del widget ----------
    // Pruebas: unirse a una barra (con su activador) y regalos de quien ya se unió.
    let siguiente = 0;
    const activador = (b, nombre, cant = 1) => ({
      tipo: 'regalo', usuario: nombre, giftId: textoLimpio(b.giftId), nombre: textoLimpio(b.regalo),
      cantidad: cant, diamantes: Math.max(1, Number(b.valor) || 1), imagen: '',
    });
    const otroRegalo = (cant, diamantes) => (nombre) => ({
      tipo: 'regalo', usuario: nombre, giftId: '0', nombre: 'Regalo', cantidad: cant, diamantes, imagen: '',
    });
    const NOMBRES = ['Camila', 'Mateo', 'Sofía', 'Samuel', 'Isabella', 'Tomás', 'Mariana', 'Emiliano'];

    const widget = tarjetaWidget({
      id: ID,
      titulo: 'Barras de activación',
      archivo: 'activacion.html',
      forma: 'cuadrado',
      // El reinicio y el reloj llegan a la vista previa sin recargarla.
      sinRecargar: ['ro', 't'],
      senal,
      personalizar: [
        casilla('Sonidos (alguien se une, cambia quién va ganando, final)', { marcada: cfg.sonido, alCambiar: (v) => { cfg.sonido = v; cambio(); } }),
        ...editorEstilo(ID, () => widget.actualizar()),
      ],
      pruebas: [
        {
          texto: 'Unirme a la siguiente barra',
          evento: (nombre) => activador(enJuego()[siguiente++ % cantidad()], nombre),
        },
        { texto: 'Mi regalo de 25', evento: otroRegalo(1, 25) },
        { texto: 'Mi combo ×10 rosas', evento: otroRegalo(10, 1) },
        {
          texto: 'Otra persona se une',
          evento: () => {
            const barras = enJuego();
            return activador(barras[Math.floor(Math.random() * barras.length)], NOMBRES[Math.floor(Math.random() * NOMBRES.length)], 5);
          },
        },
      ],
    });

    // ---------- Reloj ----------
    const tiempo = el('div', { class: 'reloj-tiempo', role: 'timer' });
    const estadoReloj = el('div', { class: 'reloj-estado' });
    const botonIniciar = el('button', { class: 'principal', onclick: iniciar });
    const botonPausar = el('button', { onclick: () => aplicarReloj(pausarReloj(relojActual())) }, 'Pausar');

    const relojActual = () => ({ ...cfg.reloj, d: duracion() });

    /** Guarda el reloj (y la ronda, si cambia) y lo manda a OBS de inmediato (sin la espera habitual). */
    function aplicarReloj(nuevo, { nuevaRonda = false } = {}) {
      cfg.reloj = { e: nuevo.e, fin: nuevo.fin, r: nuevo.r };
      if (nuevaRonda) cfg.ronda = Date.now();
      almacen.guardar();
      sincronizar.subir(ID);
      widget.actualizar();
      pintarReloj();
    }

    // Desde "Final", iniciar es empezar una ronda nueva (monedas y equipos en 0).
    function iniciar() {
      const terminada = leerReloj(relojActual()).estado === 'fin';
      aplicarReloj(iniciarReloj(terminada ? reiniciarReloj(relojActual()) : relojActual()), { nuevaRonda: terminada });
    }

    /** Monedas y equipos en 0 y reloj detenido con la duración completa. */
    function reiniciar() {
      aplicarReloj(reiniciarReloj(relojActual()), { nuevaRonda: true });
      avisarReinicio('Ronda reiniciada: las barras se vacían y todos tienen que volver a unirse.');
    }

    const TEXTOS = {
      listo: ['Lista: ya se pueden unir, pero los regalos aún no suman', 'Iniciar'],
      corre: ['En juego: los regalos suman', 'Iniciar'],
      pausa: ['En pausa: los regalos no suman', 'Reanudar'],
      fin: ['Terminó la ronda', 'Nueva ronda'],
    };
    function pintarReloj() {
      const { estado, restanteMs } = leerReloj(relojActual());
      tiempo.textContent = formatoReloj(restanteMs);
      tiempo.dataset.estado = estado;
      estadoReloj.textContent = TEXTOS[estado][0];
      botonIniciar.textContent = TEXTOS[estado][1];
      botonIniciar.disabled = estado === 'corre';
      botonPausar.disabled = estado !== 'corre';
    }
    const intervalo = setInterval(pintarReloj, 250);
    senal.addEventListener('abort', () => clearInterval(intervalo), { once: true });
    pintarReloj();

    const campoDuracion = campo('Duración de cada ronda (segundos):', {
      tipo: 'number', valor: cfg.duracion, min: DURACION_MIN_S, max: DURACION_MAX_S, step: 10,
      alCambiar: (v) => { cfg.duracion = v; cambio(); pintarReloj(); pintarMinutos(); },
    });
    const minutos = el('span', { class: 'nota sin-margen' });
    const pintarMinutos = () => { minutos.textContent = `= ${formatoReloj(duracion() * 1000)}`; };
    pintarMinutos();

    // ---------- Barras ----------
    function tarjetaBarra(b, i) {
      const valor = campo('Monedas del activador:', {
        tipo: 'number', valor: b.valor, min: 0, step: 1,
        alCambiar: (v) => { b.valor = v; cambio(); },
      });
      // Al escribir o elegir un ID del catálogo, se completan su nombre y su precio.
      const giftId = campo('ID del regalo activador:', {
        valor: b.giftId, inputMode: 'numeric', placeholder: 'ID',
        alCambiar: (v) => {
          b.giftId = v.trim();
          const delCatalogo = almacen.regalos()[b.giftId];
          b.regalo = delCatalogo ? almacen.nombreRegalo(delCatalogo) : '';
          if (delCatalogo?.diamantes) valor.querySelector('input').value = b.valor = delCatalogo.diamantes;
          nombreRegalo.textContent = b.regalo ? `Activador: ${b.regalo}` : '';
          cambio();
        },
      });
      giftId.querySelector('input').setAttribute('list', 'regalos-activacion'); // `list` es de solo lectura como propiedad
      const nombreRegalo = el('p', { class: 'nota sin-margen' }, b.regalo ? `Activador: ${b.regalo}` : '');

      return tarjeta(`Barra ${i + 1}`, {},
        el('div', { class: 'campos' },
          campo('Nombre:', { valor: b.nombre, maxLength: MAX_NOMBRE, alCambiar: (v) => { b.nombre = v; cambio(); } }),
          giftId,
          valor,
          campo('Color:', { tipo: 'color', valor: b.color, alCambiar: (v) => { b.color = v; cambio(); } })),
        nombreRegalo);
    }
    const tarjetasBarras = cfg.barras.map(tarjetaBarra);
    const mostrarBarras = () => tarjetasBarras.forEach((t, i) => { t.hidden = i >= cantidad(); });
    mostrarBarras();

    const elegirCantidad = segmentado('Barras en juego:', CANTIDADES.map((n) => [n, String(n)]), {
      valor: cantidad(),
      alCambiar: (n) => { cfg.cantidad = n; cambio(); mostrarBarras(); },
    });

    const regalos = Object.values(almacen.regalos()).sort((a, b) => (b.veces || 0) - (a.veces || 0));
    const datalist = el('datalist', { id: 'regalos-activacion' }, ...regalos.map((r) => el('option', {
      value: r.giftId,
      label: `${almacen.nombreRegalo(r) || 'Sin nombre'}${r.diamantes ? ` · ${r.diamantes} monedas` : ''}`,
    })));

    pintarProblemas();

    // ---------- Estructura ----------
    return [
      widget.elemento,

      tarjeta('Ronda', { ancha: true },
        el('div', { class: 'reloj-panel' }, tiempo, estadoReloj),
        el('div', { class: 'fila-acciones separado-arriba' },
          botonIniciar,
          botonPausar,
          el('button', { onclick: reiniciar, title: 'Detiene el reloj, vacía las barras y saca a todos de sus barras' }, 'Reiniciar ronda')),
        el('div', { class: 'campos duracion separado-arriba' }, campoDuracion),
        minutos,
        el('div', { class: 'separado-arriba' }, elegirCantidad),
        avisoReinicio,
        aviso,
        nota('Cómo se juega: cada barra tiene su regalo activador. Quien lo envía se une a esa barra (ese regalo ya le suma) y, desde ahí, ',
          'CUALQUIER regalo suyo llena esa barra. Si envía el activador de otra barra, se cambia: lo que ya sumó se queda donde estaba. ',
          'Los regalos de quien no se ha unido no suman. Unirse se puede antes de iniciar, pero las monedas solo suman con el reloj en marcha. ',
          'Al llegar a 0, gana la barra con más monedas. «Nueva ronda» y «Reiniciar ronda» vacían las barras y todos vuelven a unirse.')),

      ...tarjetasBarras,
      datalist,

      nota('TikTok no siempre manda el precio de los regalos: entonces el activador vale lo que pongas en «Monedas del activador» ',
        '(en 0, el precio del Buscador) y los demás regalos valen su precio del ',
        el('a', { href: '#/regalos' }, 'Buscador de regalos'),
        ' (si no está ahí, suman 1). Tamaño recomendado de la fuente en OBS: 1200 × 600 (con 2 barras alcanza 1200 × 400).'),
    ];
  },
};
