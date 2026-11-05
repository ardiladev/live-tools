// =============================================================================
// vistas/batalla.js — Juegos → Competencias → Batalla de regalos
//
// Configura el widget batalla.html, un tira y afloja entre dos equipos: cada uno con su
// nombre, regalo, monedas por regalo (si TikTok no manda el precio), color y foto opcional.
// "Reiniciar batalla" cambia la ronda (`ro`) y la sube a Supabase al instante: el widget
// pone los puntos en 0. Ver js/widgets/batalla.js para las claves.
// Con cronómetro (opción en Personalizar), los regalos solo cuentan con el reloj en marcha y
// cada ronda terminada le da una victoria al que ganó. El reloj se guarda como la hora en que
// termina (js/reloj.js). Las victorias las lleva el widget (solo él ve los puntos): el panel
// solo las pone en 0, cambiando `rv`.
// Secciones: 1. Valores por defecto · 2. Configuración del widget · 3. Vista
//            (tarjeta · reloj y victorias · equipos · estructura)
// =============================================================================

import * as almacen from '../almacen.js';
import { editorEstilo } from '../estilo.js';
import { textoLimpio, acotarDuracion, listaRegalos, usarLista, relojDeRonda, campoDuracion, TEXTOS_RELOJ } from '../piezas.js';
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
  ronda: 0,                // cambia al reiniciar: el widget pone los puntos en 0
  conReloj: true,          // los regalos solo cuentan con el reloj en marcha; cada ronda da una victoria
  duracion: 180,           // segundos
  reloj: { e: 'listo', fin: 0, r: 0 },
  rondaVictorias: 0,       // cambia al reiniciar las victorias: el widget las pone en 0
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
const duracion = () => acotarDuracion(ajustes().duracion, POR_DEFECTO.duracion);
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
    return {
      a, b, ro: cfg.ronda, s: cfg.sonido ? 1 : 0,
      cr: cfg.conReloj ? 1 : 0, t: { ...cfg.reloj, d: duracion() }, rv: cfg.rondaVictorias,
    };
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
      // El reinicio, el reloj y las victorias llegan a la vista previa sin recargarla.
      sinRecargar: ['ro', 't', 'rv'],
      senal,
      personalizar: [
        casilla('Con cronómetro: los regalos solo cuentan con el reloj en marcha, y cada ronda da una victoria', {
          marcada: cfg.conReloj,
          alCambiar: (v) => { cfg.conReloj = v; cambio(); mostrarReloj(); },
        }),
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

    // ---------- Reloj y victorias ----------
    const reloj = relojDeRonda({
      id: ID, cfg, duracion, actualizar: () => widget.actualizar(), senal,
      textos: {
        ...TEXTOS_RELOJ,
        corre: ['En juego: los regalos suman', 'Iniciar'],
        pausa: ['En pausa: los regalos no suman', 'Reanudar'],
      },
    });

    /** Puntos en 0 y reloj detenido con la duración completa (las victorias se quedan). */
    function reiniciar() {
      reloj.reiniciar();
      avisarReinicio('Batalla reiniciada: los puntos de los dos equipos vuelven a 0 en OBS.');
    }

    /**
     * Victorias en 0. Si la ronda ya terminó, también empieza otra: si no, el widget volvería
     * a darle la victoria de esa ronda al que la ganó.
     */
    function reiniciarVictorias() {
      cfg.rondaVictorias = Date.now();
      if (reloj.terminada()) reloj.reiniciar();
      else reloj.aplicar(reloj.actual());
      avisarReinicio('Victorias reiniciadas: los dos equipos vuelven a 0 victorias en OBS.');
    }

    const duracionRonda = campoDuracion('Duración de cada ronda (segundos):', { cfg, duracion, alCambiar: () => { cambio(); reloj.pintar(); } });

    // Lo que solo tiene sentido con cronómetro se oculta sin él.
    const botonVictorias = el('button', {
      onclick: reiniciarVictorias, title: 'Pone las victorias y las rachas de los dos equipos en 0',
    }, 'Reiniciar victorias');
    const notaReloj = nota('Iniciar, pausar y reiniciar llegan a OBS en uno o dos segundos. Con el reloj detenido, los regalos no suman. ',
      'Cuando el reloj llega a 0, el equipo con más monedas gana la ronda: el widget le suma una victoria y, con 2 o más seguidas, ',
      'muestra su racha (un empate no suma ni corta la racha). «Nueva ronda» pone los puntos en 0 y conserva las victorias. ',
      'Las victorias se ven solo en OBS: el panel no recibe los puntos.');
    const notaSinReloj = nota('El reinicio llega a OBS en uno o dos segundos. Si OBS recarga la fuente, los puntos se conservan hasta que reinicies.');
    function mostrarReloj() {
      [reloj.panel, duracionRonda.fila, duracionRonda.minutos, reloj.botonIniciar, reloj.botonPausar, botonVictorias, notaReloj]
        .forEach((nodo) => { nodo.hidden = !cfg.conReloj; });
      notaSinReloj.hidden = cfg.conReloj;
    }
    mostrarReloj();

    // ---------- Equipos ----------
    const datalist = listaRegalos('regalos-batalla');

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
      usarLista(giftId.querySelector('input'), datalist);
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

    pintarProblemas();

    // ---------- Estructura ----------
    return [
      widget.elemento,

      tarjeta('Batalla', { ancha: true },
        reloj.panel,
        el('div', { class: 'fila-acciones separado-arriba' },
          reloj.botonIniciar,
          reloj.botonPausar,
          el('button', { onclick: reiniciar, title: 'Detiene el reloj y pone los puntos de los dos equipos en 0' }, 'Reiniciar batalla'),
          botonVictorias),
        duracionRonda.fila,
        duracionRonda.minutos,
        avisoReinicio,
        aviso,
        notaReloj,
        notaSinReloj),

      ...[0, 1].map((i) => tarjetaEquipo(cfg.equipos[i], i)),
      datalist,

      nota('Cada regalo suma monedas × cantidad, y la barra muestra qué parte del total lleva cada equipo. TikTok no siempre manda el precio: ',
        'entonces vale lo que pongas en «Monedas por regalo». Busca los IDs en el ',
        el('a', { href: '#/regalos' }, 'Buscador de regalos'), '. Tamaño recomendado de la fuente en OBS: 1600 × 300, arriba de la escena.'),
    ];
  },
};
