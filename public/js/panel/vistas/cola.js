// =============================================================================
// vistas/cola.js — Juegos → Retos del público → Cola de retos
//
// Cuando llegan muchos regalos seguidos, el equipo no alcanza a hacer los retos en el momento.
// La cola los guarda en orden y el equipo los va marcando como hechos, con calma.
//
// Esta vista configura el widget cola.html y, sobre todo, MUESTRA LA COLA REAL: la lee de
// Supabase (tabla `retos`, ver supabase/esquema.sql) y se actualiza sola. Desde aquí se marca
// cada reto como hecho (y se puede deshacer), se agregan retos a mano y se vacía la cola.
// Los retos llegan de:
//   - la ruleta y el tragamonedas, si en su "Personalizar" se activó "Mandar a la Cola de retos"
//     (usan idCola() de este archivo),
//   - los "retos por regalo" de aquí (regalo → reto fijo), que agrega el widget en OBS.
// Marcar como hecho pide el secreto del panel: se hace desde el navegador donde está el panel.
// Ver js/widgets/cola.js para las claves.
// Secciones: 1. Valores por defecto · 2. Configuración del widget · 3. Para la ruleta y el
//            tragamonedas · 4. Vista
// =============================================================================

import * as almacen from '../almacen.js';
import { nubeActiva, escucharRetos, leerRetos, agregarReto, marcarReto, vaciarRetos } from '../../nube.js';
import { editorEstilo } from '../estilo.js';
import * as sincronizar from '../sincronizar.js';
import { el, tarjeta, tarjetaWidget, campo, casilla, nota, crearAviso, numero } from '../ui.js';


// -----------------------------------------------------------------------------
// 1. Valores por defecto
// -----------------------------------------------------------------------------

const ID = 'cola-retos';
const MAX_RETOS_REGALO = 20;
const MAX_TEXTO = 120;

const POR_DEFECTO = {
  titulo: 'Retos pendientes',
  visibles: 5,            // cuántos se ven a la vez en OBS (3 a 8)
  usuario: true,          // mostrar quién lo pidió
  ocultar: false,         // ocultar el widget cuando no hay retos
  sonido: true,
  porRegalo: [],          // retos por regalo: { giftId, texto } (vacío: cada uno decide sus regalos)
};


// -----------------------------------------------------------------------------
// 2. Configuración del widget
// -----------------------------------------------------------------------------
// Se registra al cargar, para que los cambios en vivo funcionen con o sin la vista abierta.

const ajustes = () => almacen.widget(ID, POR_DEFECTO);
const textoLimpio = (texto) => String(texto ?? '').trim();

sincronizar.registrar(ID, {
  config: () => {
    const cfg = ajustes();
    const catalogo = almacen.regalos();
    return {
      ti: textoLimpio(cfg.titulo).slice(0, 30),
      mx: Math.min(8, Math.max(3, Number(cfg.visibles) || 5)),
      us: cfg.usuario ? 1 : 0,
      oc: cfg.ocultar ? 1 : 0,
      s: cfg.sonido ? 1 : 0,
      rg: cfg.porRegalo
        .filter((r) => textoLimpio(r.giftId) && textoLimpio(r.texto))
        .slice(0, MAX_RETOS_REGALO)
        .map((r) => {
          const delCatalogo = catalogo[textoLimpio(r.giftId)];
          return {
            g: textoLimpio(r.giftId),
            gn: almacen.nombreRegalo(delCatalogo).slice(0, 30),
            t: textoLimpio(r.texto).slice(0, MAX_TEXTO),
            img: delCatalogo?.imagen || '',
          };
        }),
      // La vista previa no lleva `w`: con esto también muestra la cola real (sin tocarla).
      cl: idCola(),
    };
  },
});


// -----------------------------------------------------------------------------
// 3. Para la ruleta y el tragamonedas
// -----------------------------------------------------------------------------

/** El id de la cola (el del widget cola.html), o '' si no hay cambios en vivo (Supabase). */
export const idCola = () => (nubeActiva() ? almacen.idNube(ID) : '');

/** Supabase solo acepta retos en una cola que ya existe: se guarda su configuración ya. */
export const asegurarCola = () => sincronizar.subir(ID);


// -----------------------------------------------------------------------------
// 4. Vista
// -----------------------------------------------------------------------------

/** "hace 3 min" a partir de una fecha de Supabase. */
function haceCuanto(fecha) {
  const segundos = Math.max(0, Math.round((Date.now() - new Date(fecha).getTime()) / 1000));
  if (segundos < 60) return 'hace un momento';
  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return `hace ${minutos} min`;
  return `hace ${Math.round(minutos / 60)} h`;
}

export default {
  id: ID,
  titulo: 'Cola de retos',
  descripcion: 'Los retos que salen de la ruleta, el tragamonedas o de un regalo hacen fila en pantalla. Tu equipo los hace con calma y los marca como hechos desde aquí.',

  render({ senal }) {
    const cfg = ajustes();
    const cambio = () => {
      almacen.guardar();
      widget.actualizar();
    };

    // ---------- Tarjeta del widget ----------
    const regaloDePrueba = (cantidad) => (nombre) => {
      const giftId = textoLimpio(cfg.porRegalo.find((r) => textoLimpio(r.giftId) && textoLimpio(r.texto))?.giftId) || '0';
      return { tipo: 'regalo', usuario: nombre, giftId, nombre: '', cantidad, diamantes: 0, imagen: '' };
    };

    const widget = tarjetaWidget({
      id: ID,
      titulo: 'Cola de retos',
      archivo: 'cola.html',
      forma: 'vertical',
      senal,
      campos: [
        campo('Título:', { valor: cfg.titulo, maxLength: 30, alCambiar: (v) => { cfg.titulo = v; cambio(); } }),
        campo('Retos a la vista:', {
          tipo: 'select', valor: cfg.visibles, opciones: [3, 4, 5, 6, 7, 8].map((n) => [n, String(n)]),
          alCambiar: (v) => { cfg.visibles = Number(v); cambio(); },
        }),
      ],
      personalizar: [
        casilla('Mostrar quién pidió cada reto', { marcada: cfg.usuario, alCambiar: (v) => { cfg.usuario = v; cambio(); } }),
        casilla('Ocultar el widget cuando no hay retos', { marcada: cfg.ocultar, alCambiar: (v) => { cfg.ocultar = v; cambio(); } }),
        casilla('Sonido al llegar un reto', { marcada: cfg.sonido, alCambiar: (v) => { cfg.sonido = v; cambio(); } }),
        ...editorEstilo(ID, () => widget.actualizar()),
      ],
      pruebas: [
        { texto: 'Reto de prueba', evento: regaloDePrueba(1) },
        { texto: 'Combo ×5', evento: regaloDePrueba(5) },
      ],
    });

    if (!nubeActiva()) {
      return [widget.elemento, nota('La Cola de retos necesita los cambios en vivo (Supabase): sin ellos, el panel no puede ver ni marcar los retos.')];
    }

    // ---------- Retos pendientes (la cola real) ----------
    const aviso = el('div', { class: 'aviso', role: 'status' });
    const avisar = crearAviso(aviso);
    const estado = el('p', { class: 'nota sin-margen' }, 'Cargando la cola…');
    const listaPendientes = el('div', { class: 'cola-lista' });
    const listaHechos = el('div', { class: 'cola-lista' });
    const tituloHechos = el('h3', { class: 'cola-subtitulo', hidden: true }, 'Hechos hace poco');
    const botonHecho = el('button', { class: 'principal', disabled: true }, '✔ Hecho (el primero)');
    const botonDeshacer = el('button', { disabled: true, title: 'Devuelve a la cola el último reto marcado como hecho' }, '↶ Deshacer el último');
    const botonVaciar = el('button', { title: 'Borra todos los retos de la cola' }, 'Vaciar la cola');
    let datos = { pendientes: [], hechos: [], total: 0 };

    // Al marcar, la fila se va de una vez (sin esperar la vuelta por Supabase); si falla, se relee.
    async function marcar(reto, hecho) {
      if (hecho) datos.pendientes = datos.pendientes.filter((r) => r.id !== reto.id);
      else datos.hechos = datos.hechos.filter((r) => r.id !== reto.id);
      pintar();
      try {
        await marcarReto(idCola(), almacen.secretoNube(), reto.id, hecho);
        avisar(hecho ? `Hecho: «${reto.texto}».` : `«${reto.texto}» vuelve a la cola.`);
      } catch (error) {
        avisar(`No se pudo guardar: ${error.message}`, { error: true });
        leerRetos(idCola()).then(recibir).catch(() => {});
      }
    }

    let confirmarVaciar = 0;
    botonHecho.onclick = () => datos.pendientes[0] && marcar(datos.pendientes[0], true);
    botonDeshacer.onclick = () => datos.hechos[0] && marcar(datos.hechos[0], false);
    // Vaciar se confirma con un segundo clic (sin ventanas emergentes del navegador).
    botonVaciar.onclick = async () => {
      if (Date.now() - confirmarVaciar > 4000) {
        confirmarVaciar = Date.now();
        botonVaciar.textContent = '¿Seguro? Pulsa otra vez';
        setTimeout(() => { botonVaciar.textContent = 'Vaciar la cola'; }, 4000);
        return;
      }
      confirmarVaciar = 0;
      botonVaciar.textContent = 'Vaciar la cola';
      try {
        await vaciarRetos(idCola(), almacen.secretoNube());
        avisar('Cola vaciada.');
      } catch (error) {
        avisar(`No se pudo vaciar: ${error.message}`, { error: true });
      }
    };

    function filaReto(reto, i, { hecho = false } = {}) {
      const cantidad = reto.cantidad > 1 ? ` ×${numero(reto.cantidad)}` : '';
      const detalle = [reto.usuario, reto.origen, haceCuanto(hecho ? reto.hecho : reto.creado)].filter(Boolean).join(' · ');
      return el('div', { class: `cola-fila${!hecho && i === 0 ? ' actual' : ''}${hecho ? ' hecha' : ''}` },
        el('span', { class: 'cola-numero' }, hecho ? '✔' : String(i + 1)),
        reto.imagen ? el('img', { class: 'icono-regalo grande', src: reto.imagen, alt: '' }) : el('span'),
        el('div', { class: 'cola-texto' },
          el('b', {}, reto.texto, cantidad),
          el('span', { class: 'nota sin-margen' }, detalle)),
        hecho
          ? el('button', { onclick: () => marcar(reto, false), title: 'Devolver a la cola' }, 'Deshacer')
          : el('button', { class: i === 0 ? 'principal' : '', onclick: () => marcar(reto, true) }, 'Hecho'));
    }

    function pintar() {
      const total = Math.max(datos.pendientes.length, Number(datos.total) || 0);
      estado.textContent = total
        ? `${numero(total)} reto${total === 1 ? '' : 's'} pendiente${total === 1 ? '' : 's'}.${total > datos.pendientes.length ? ` Se ven los primeros ${datos.pendientes.length}.` : ''}`
        : 'No hay retos pendientes.';
      listaPendientes.replaceChildren(...datos.pendientes.map((r, i) => filaReto(r, i)));
      listaHechos.replaceChildren(...datos.hechos.slice(0, 5).map((r, i) => filaReto(r, i, { hecho: true })));
      tituloHechos.hidden = !datos.hechos.length;
      botonHecho.disabled = !datos.pendientes.length;
      botonDeshacer.disabled = !datos.hechos.length;
    }

    function recibir(nuevos) {
      datos = { pendientes: nuevos?.pendientes || [], hechos: nuevos?.hechos || [], total: nuevos?.total || 0 };
      pintar();
    }

    // Supabase solo acepta retos en una cola guardada: se guarda antes de escuchar.
    asegurarCola()
      .then(async () => {
        if (senal.aborted) return;
        const dejar = await escucharRetos(idCola(), recibir, {
          alEstado: (ok, mensaje) => { if (!ok) estado.textContent = mensaje; },
          respaldoMs: 15000,
        });
        if (senal.aborted) dejar();
        else senal.addEventListener('abort', dejar, { once: true });
      })
      .catch((error) => { estado.textContent = `No se pudo conectar con la cola: ${error.message}`; });
    // "hace X min" se mantiene al día.
    const reloj = setInterval(pintar, 30000);
    senal.addEventListener('abort', () => clearInterval(reloj), { once: true });

    // ---------- Agregar a mano ----------
    const textoManual = el('input', { maxLength: MAX_TEXTO, placeholder: 'Ej.: Cantar el coro de…', 'aria-label': 'Reto a agregar' });
    const usuarioManual = el('input', { maxLength: 40, placeholder: 'Para quién (opcional)', 'aria-label': 'Quién lo pidió' });
    async function agregarManual() {
      const texto = textoLimpio(textoManual.value);
      if (!texto) return avisar('Escribe el reto.', { error: true });
      try {
        await agregarReto(idCola(), { texto, usuario: textoLimpio(usuarioManual.value), origen: 'Panel' });
        textoManual.value = '';
        usuarioManual.value = '';
        avisar(`Agregado: «${texto}».`);
      } catch (error) {
        avisar(`No se pudo agregar: ${error.message}`, { error: true });
      }
    }
    textoManual.addEventListener('keydown', (e) => { if (e.key === 'Enter') agregarManual(); });

    // ---------- Retos por regalo ----------
    const listaRegalos = el('div');
    const datalist = el('datalist', { id: 'regalos-cola' });
    const regalos = Object.values(almacen.regalos()).sort((a, b) => (b.veces || 0) - (a.veces || 0));
    datalist.replaceChildren(...regalos.map((r) => el('option', {
      value: r.giftId,
      label: `${almacen.nombreRegalo(r) || 'Sin nombre'}${r.diamantes ? ` · ${r.diamantes} monedas` : ''}`,
    })));
    const botonAgregarRegalo = el('button', {
      class: 'enlace separado-arriba',
      onclick: () => {
        if (cfg.porRegalo.length >= MAX_RETOS_REGALO) return;
        cfg.porRegalo.push({ giftId: '', texto: '' });
        cambio();
        pintarRegalos();
      },
    }, '+ Agregar regalo');

    function filaRegalo(r, i) {
      const nombre = el('span', { class: 'nota sin-margen' });
      const miniatura = el('img', { class: 'icono-regalo grande', alt: '' });
      const pintarNombre = () => {
        const delCatalogo = almacen.regalos()[textoLimpio(r.giftId)];
        nombre.textContent = delCatalogo ? almacen.nombreRegalo(delCatalogo) || 'Sin nombre' : (textoLimpio(r.giftId) ? 'No está en el Buscador' : '');
        if (delCatalogo?.imagen) miniatura.src = delCatalogo.imagen;
        else miniatura.removeAttribute('src');
        miniatura.hidden = !delCatalogo?.imagen;
      };
      pintarNombre();
      const id = el('input', {
        value: r.giftId, inputMode: 'numeric', placeholder: 'ID', 'aria-label': `ID del regalo ${i + 1}`,
        oninput: (e) => { r.giftId = e.target.value.trim(); cambio(); pintarNombre(); },
      });
      id.setAttribute('list', datalist.id);
      return el('div', { class: 'reto-regalo-fila' },
        el('span', {}, miniatura), // la celda queda aunque la miniatura esté oculta
        el('div', { class: 'reto-regalo-id' }, id, nombre),
        el('input', {
          value: r.texto, maxLength: MAX_TEXTO, placeholder: 'Reto (ej.: 10 sentadillas)', 'aria-label': `Reto del regalo ${i + 1}`,
          oninput: (e) => { r.texto = e.target.value; cambio(); },
        }),
        el('button', {
          title: 'Quitar', 'aria-label': `Quitar el regalo ${i + 1}`,
          onclick: () => { cfg.porRegalo.splice(i, 1); cambio(); pintarRegalos(); },
        }, '✕'));
    }

    function pintarRegalos() {
      listaRegalos.replaceChildren(...cfg.porRegalo.map(filaRegalo));
      botonAgregarRegalo.disabled = cfg.porRegalo.length >= MAX_RETOS_REGALO;
    }
    pintarRegalos();

    // ---------- Estructura ----------
    return [
      widget.elemento,

      tarjeta('Retos pendientes', { ancha: true },
        el('div', { class: 'fila-acciones' }, botonHecho, botonDeshacer, botonVaciar),
        aviso,
        estado,
        listaPendientes,
        el('div', { class: 'cola-agregar separado-arriba' },
          textoManual, usuarioManual,
          el('button', { onclick: agregarManual }, '+ Agregar a la cola')),
        tituloHechos,
        listaHechos,
        nota('Esta lista es la misma que se ve en OBS y se actualiza sola. «Hecho» quita el reto de la pantalla en uno o dos ',
          'segundos; si te equivocas, «Deshacer» lo devuelve a su lugar. Marcar y vaciar solo funciona desde este navegador ',
          '(el del panel), porque pide su clave secreta.')),

      tarjeta(`Retos por regalo (hasta ${MAX_RETOS_REGALO})`, { ancha: true },
        datalist,
        listaRegalos,
        botonAgregarRegalo,
        nota('Cuando alguien envía uno de estos regalos, su reto entra a la cola. Un combo cuenta como un solo reto con su ',
          'cantidad (por ejemplo «10 sentadillas ×5»). Para encontrar el ID de un regalo usa el ',
          el('a', { href: '#/regalos' }, 'Buscador de regalos'), '. ',
          'La ruleta y el tragamonedas también pueden mandar sus resultados aquí: actívalo en su «Personalizar».')),

      nota('Tamaño recomendado de la fuente en OBS: 600 × 900, a un costado de la escena. Pon esta fuente una sola vez: ',
        'si la abres en dos escenas o programas a la vez, los retos por regalo entrarían dos veces.'),
    ];
  },
};
