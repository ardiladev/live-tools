// =============================================================================
// activacion.js — Lógica del widget "Barra de activación" (activacion.html)
//
// Una sola barra repartida en 2 a 4 cuadrantes, uno por equipo. Cada equipo tiene su regalo
// activador. Las reglas:
//   - Quien envía el activador de un equipo queda unido a él (ese regalo ya le suma).
//   - Desde ahí, CUALQUIER regalo de esa persona suma sus monedas a su equipo.
//   - Si envía el activador de otro equipo, se cambia: lo que ya sumó se queda donde estaba.
//   - Los regalos de quien no se ha unido a ningún equipo no suman.
// Cada cuadrante ocupa de la barra la parte del total de monedas que lleva su equipo (sin
// monedas, todos miden lo mismo). Las monedas solo suman con el reloj en marcha (y unos segundos
// de gracia al final, por los combos que se cuentan tarde); unirse sí se puede antes de iniciar.
// Al terminar, gana el equipo con más monedas.
//
// A cada persona se la reconoce por el id de su cuenta (`uid`, ver comun.js); los regalos de
// prueba del panel no lo traen y se reconocen por el nombre.
//
// Configuración (la genera el panel; llega en #c=… o, con cambios en vivo, desde Supabase):
//   u, k = usuario y clave
//   eq = equipos [{ n: nombre, g: id del regalo activador, v: monedas del activador (si TikTok no
//        manda el precio), c: color, img: imagen del regalo }] (de 2 a 4)
//   pr = precios del Buscador de regalos { giftId: monedas }, para los regalos que llegan sin
//        precio (si tampoco está ahí, el regalo suma 1)
//   ro = ronda (al cambiar, las monedas y los equipos vuelven a 0) · s = sonido (1/0)
//   t = reloj { e, d, fin, r } (ver js/reloj.js) · est = estilo visual (js/tema.js)
//
// La ronda (monedas, quién está en cada equipo y quién aportó más) se guarda en este navegador:
// si OBS recarga la fuente, se conserva.
// Secciones: 1. Configuración · 2. Ronda guardada · 3. Pintado · 4. Reloj · 5. Regalos · 6. Arranque
// =============================================================================

import { leerConfig, iniciarWidget, sonar } from '../comun.js';
import { leerReloj, formatoReloj } from '../reloj.js';
import { prueba, leerGuardado, escribirGuardado, enGracia, relojCuenta, animarCifra } from '../juego.js';


// -----------------------------------------------------------------------------
// 1. Configuración
// -----------------------------------------------------------------------------

const MIN_EQUIPOS = 2;
const MAX_EQUIPOS = 4;
const CUADRANTE_MIN = 3;     // % mínimo de un cuadrante con monedas (para que siempre se vea)
const ANCHO_ETIQUETA = 8;    // % mínimo de un cuadrante para mostrar su imagen y porcentaje
const CONTEO_MS = 500;       // duración de la animación del número
const AVISO_UNION_MS = 3500; // cuánto se ve "Fulano se unió a…"
const AVISO_FINAL_S = 5;     // segundos finales con "tic" de aviso
const MAX_PERSONAS = 5000;   // personas que se recuerdan por ronda (el guardado no crece sin fin)
const COLORES = ['#D4AF37', '#C9CDD4', '#B87333', '#8FB9A8'];
const ESTADOS = { listo: 'Lista', corre: 'En juego', pausa: 'En pausa', fin: 'Final' };

let equipos = [];
let precios = {};
let sonido = true;
let ronda = null;
let reloj = { e: 'listo', d: 180 };
let claveGuardado = '';

// La ronda: monedas por equipo y, por persona, su equipo y lo que aportó a cada uno. Se llevan
// siempre los 4 equipos, aunque haya menos en juego: así no se pierde nada si el panel quita
// uno a mitad de ronda y luego lo vuelve a poner.
let puntos = [];
let personas = new Map(); // clave de la persona → { nombre, equipo, aportes: [monedas por equipo] }

const urlSegura = (texto) => (/^https?:\/\//i.test(String(texto || '')) ? String(texto) : '');

function normalizarEquipo(e, i) {
  return {
    nombre: String(e?.n || `Equipo ${i + 1}`).slice(0, 24),
    giftId: String(e?.g ?? '').trim(),
    valor: Math.max(0, Number(e?.v) || 0),
    color: /^#[0-9a-f]{6}$/i.test(e?.c) ? e.c : COLORES[i],
    imagen: urlSegura(e?.img),
  };
}

/** Aplica una configuración. Puede llegar en cualquier momento (cambios en vivo, reinicio, reloj). */
function aplicarConfig(cfg) {
  const lista = Array.isArray(cfg.eq) ? cfg.eq.slice(0, MAX_EQUIPOS) : [];
  while (lista.length < MIN_EQUIPOS) lista.push({});
  equipos = lista.map(normalizarEquipo);
  precios = cfg.pr && typeof cfg.pr === 'object' ? cfg.pr : {};
  sonido = cfg.s !== 0;
  reloj = cfg.t && typeof cfg.t === 'object' ? cfg.t : { e: 'listo', d: 180 };
  claveGuardado = `${CLAVE_RONDA}${cfg.w || 'url'}`;

  // Ronda nueva (el panel pulsó "Reiniciar" o "Nueva ronda"): todo vuelve a 0.
  const nuevaRonda = Number(cfg.ro) || 0;
  if (nuevaRonda !== ronda) {
    ronda = nuevaRonda;
    puntos = [];
    personas = new Map();
    restaurarRonda();
  }
  ajustarCantidad();

  armarEquipos();
  pintarReloj();
  pintar(false);
}

/** Monedas de los 4 equipos, y lo que aportó cada persona a cada uno (lo que falte, en 0). */
const cuatro = (lista) => Array.from({ length: MAX_EQUIPOS }, (_, i) => Math.max(0, Number(lista?.[i]) || 0));

function ajustarCantidad() {
  puntos = cuatro(puntos);
  for (const persona of personas.values()) persona.aportes = cuatro(persona.aportes);
}

/** Las monedas de los equipos en juego. */
const enJuego = () => puntos.slice(0, equipos.length);

/** Equipo de una persona, o -1 si no tiene (o si su equipo no está en juego: tiene que volver a unirse). */
const equipoDe = (persona) => (persona && persona.equipo >= 0 && persona.equipo < equipos.length ? persona.equipo : -1);


// -----------------------------------------------------------------------------
// 2. Ronda guardada (para que una recarga de OBS no la borre)
// -----------------------------------------------------------------------------

const CLAVE_RONDA = 'live-tools:activacion:';

function restaurarRonda() {
  const guardado = leerGuardado(claveGuardado);
  if (guardado?.ro !== ronda) return; // la ronda empieza en 0
  if (Array.isArray(guardado.p)) puntos = cuatro(guardado.p);
  if (Array.isArray(guardado.per)) {
    for (const [clave, nombre, equipo, aportes] of guardado.per) {
      if (!clave || !Array.isArray(aportes)) continue;
      personas.set(String(clave), { nombre: String(nombre || ''), equipo: Number.isInteger(equipo) ? equipo : -1, aportes: cuatro(aportes) });
    }
  }
}

function guardarRonda() {
  const per = [...personas].map(([clave, p]) => [clave, p.nombre, p.equipo, p.aportes]);
  escribirGuardado(claveGuardado, { ro: ronda, p: puntos, per });
}


// -----------------------------------------------------------------------------
// 3. Pintado
// -----------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);
const formato = new Intl.NumberFormat('es-CO');
let cuadrantes = []; // nodos de cada cuadrante de la barra, en el mismo orden que `equipos`
let fichas = [];     // nodos de cada equipo en la leyenda de abajo

function ponerImagen(img, url) {
  if (img.getAttribute('src') !== url) {
    if (url) img.src = url;
    else img.removeAttribute('src');
  }
  img.hidden = !url;
}

/** Copias de una plantilla del HTML, una por equipo. */
const copias = (id) => equipos.map(() => $(id).content.firstElementChild.cloneNode(true));

/**
 * Un cuadrante en la barra y una ficha en la leyenda por equipo (solo se rehacen si cambia
 * cuántos hay), con su nombre, color e imagen.
 */
function armarEquipos() {
  if (cuadrantes.length !== equipos.length) {
    cuadrantes = copias('plantilla-cuadrante').map((nodo) => ({
      nodo,
      regalo: nodo.querySelector('.regalo'),
      porcentaje: nodo.querySelector('.porcentaje'),
    }));
    fichas = copias('plantilla-ficha').map((nodo) => ({
      nodo,
      regalo: nodo.querySelector('.regalo'),
      inicial: nodo.querySelector('.inicial'),
      nombre: nodo.querySelector('.nombre'),
      monedas: nodo.querySelector('.monedas'),
      miembros: nodo.querySelector('.miembros'),
      mejor: nodo.querySelector('.mejor'),
      mostrado: null,
      animacion: 0,
    }));
    $('barra').replaceChildren(...cuadrantes.map((c) => c.nodo));
    $('leyenda').replaceChildren(...fichas.map((f) => f.nodo));
  }
  $('leyenda').dataset.cantidad = equipos.length;
  equipos.forEach((e, i) => {
    cuadrantes[i].nodo.style.setProperty('--color', e.color);
    ponerImagen(cuadrantes[i].regalo, e.imagen);
    const ficha = fichas[i];
    ficha.nodo.style.setProperty('--color', e.color);
    ficha.nombre.textContent = e.nombre;
    ponerImagen(ficha.regalo, e.imagen);
    ficha.inicial.textContent = e.imagen ? '' : e.nombre.charAt(0).toUpperCase();
  });
}

/** Cuántas personas hay en cada equipo y quién aportó más a cada uno. */
function resumenEquipos() {
  const miembros = equipos.map(() => 0);
  const mejores = equipos.map(() => null);
  for (const persona of personas.values()) {
    if (equipoDe(persona) >= 0) miembros[persona.equipo] += 1;
    mejores.forEach((mejor, i) => {
      const monedas = persona.aportes[i];
      if (monedas > 0 && (!mejor || monedas > mejor.monedas)) mejores[i] = { nombre: persona.nombre, monedas };
    });
  }
  return { miembros, mejores };
}

/** Índice del equipo que va ganando, o `null` si no hay monedas o hay empate arriba. */
function quienGana() {
  const lista = enJuego();
  const maximo = Math.max(0, ...lista);
  if (!maximo) return null;
  const primeras = lista.filter((p) => p === maximo).length;
  return primeras === 1 ? lista.indexOf(maximo) : null;
}

/**
 * Qué parte de la barra ocupa cada cuadrante (en %, suman 100): la parte del total de monedas
 * de su equipo. Un equipo con monedas nunca baja de CUADRANTE_MIN; sin monedas en total,
 * todos miden lo mismo.
 */
function anchos() {
  const lista = enJuego();
  const total = lista.reduce((a, b) => a + b, 0);
  if (!total) return lista.map(() => 100 / lista.length);
  const crudos = lista.map((p) => (p ? Math.max(CUADRANTE_MIN, (p / total) * 100) : 0));
  const suma = crudos.reduce((a, b) => a + b, 0);
  return crudos.map((a) => (a / suma) * 100);
}

let avisoUnion = null; // { texto, hasta } mientras se muestra "Fulano se unió a…"

/** Cuadrantes, porcentajes, leyenda y el aviso de abajo. Con `animar`, los números suben poco a poco. */
function pintar(animar = true) {
  const lista = enJuego();
  const total = lista.reduce((a, b) => a + b, 0);
  const medidas = anchos();
  const { miembros, mejores } = resumenEquipos();
  const lider = quienGana();
  cuadrantes.forEach((c, i) => {
    const parte = total ? (lista[i] / total) * 100 : 0;
    c.nodo.style.width = `${medidas[i]}%`;
    // Sin monedas todavía, no hay porcentaje que mostrar. Un equipo con monedas nunca muestra "0%";
    // en un cuadrante muy angosto la etiqueta se oculta.
    c.porcentaje.textContent = !total ? '' : lista[i] && parte < 0.5 ? '<1%' : `${Math.round(parte)}%`;
    c.nodo.classList.toggle('angosto', medidas[i] < ANCHO_ETIQUETA);
    c.nodo.classList.toggle('gana', lider === i);
  });
  fichas.forEach((ficha, i) => {
    ficha.miembros.textContent = `👥 ${miembros[i]}`;
    ficha.mejor.textContent = mejores[i] ? `⭐ ${mejores[i].nombre}` : '';
    ficha.nodo.classList.toggle('gana', lider === i);
    animarCifra(ficha, lista[i], { animar, ms: CONTEO_MS, escribir: (valor) => { ficha.monedas.textContent = formato.format(valor); } });
  });
  pintarAviso(lider);
}

function pintarAviso(lider = quienGana()) {
  const aviso = $('aviso');
  const { estado } = leerReloj(reloj);
  const hayMonedas = Math.max(0, ...enJuego()) > 0;
  let texto;
  if (avisoUnion && Date.now() < avisoUnion.hasta) texto = avisoUnion.texto;
  else if (estado === 'fin') {
    texto = lider === null
      ? (hayMonedas ? 'Terminó en empate' : 'Terminó la ronda')
      : `¡Ganó ${equipos[lider].nombre} con ${formato.format(puntos[lider])} monedas!`;
  } else if (lider !== null) texto = `Va ganando ${equipos[lider].nombre}`;
  else texto = hayMonedas ? 'Empate' : 'Envía un regalo activador para unirte a un equipo';
  aviso.textContent = texto;
  aviso.style.setProperty('--color', lider === null ? 'transparent' : equipos[lider].color);
}

/** "+25" que sube desde la ficha del equipo, y un golpe en su ícono. */
function mostrarSuma(i, suma) {
  const ficha = fichas[i];
  const flotante = document.createElement('span');
  flotante.className = 'suma';
  flotante.textContent = `+${formato.format(suma)}`;
  flotante.addEventListener('animationend', () => flotante.remove());
  ficha.nodo.append(flotante);
  ficha.nodo.classList.remove('golpe');
  void ficha.nodo.offsetWidth; // reinicia la animación
  ficha.nodo.classList.add('golpe');
}


// -----------------------------------------------------------------------------
// 4. Reloj
// -----------------------------------------------------------------------------

let estadoAnterior = null;
let ultimoTic = null;

function pintarReloj() {
  const { estado, restanteMs } = leerReloj(reloj);
  const caja = $('reloj');
  caja.dataset.estado = estado;
  caja.classList.toggle('urgente', estado === 'corre' && restanteMs <= 10000);
  $('tiempo').textContent = formatoReloj(restanteMs);
  $('estado-reloj').textContent = ESTADOS[estado];

  // Sonidos: "tic" en los últimos segundos y campana al terminar (solo si se vio terminar).
  const segundo = Math.ceil(restanteMs / 1000);
  if (sonido && estado === 'corre' && segundo <= AVISO_FINAL_S && segundo !== ultimoTic) {
    ultimoTic = segundo;
    sonar({ frecuencia: 990, duracion: 0.08, volumen: 0.08, subida: 1 });
  }
  if (sonido && estado === 'fin' && estadoAnterior === 'corre') sonar({ frecuencia: 523, duracion: 0.9, subida: 2 });
  if (estado !== estadoAnterior && estadoAnterior !== null) pintar(false); // el aviso dice "Ganó…" al terminar
  estadoAnterior = estado;

  // Se acabó el aviso de quién se unió: vuelve el de quién va ganando.
  if (avisoUnion && Date.now() >= avisoUnion.hasta) {
    avisoUnion = null;
    pintarAviso();
  }
}


// -----------------------------------------------------------------------------
// 5. Regalos
// -----------------------------------------------------------------------------

/** ¿Suman monedas los regalos que llegan ahora? Con el reloj en marcha (y la gracia final). */
const cuentaAhora = () => prueba || relojCuenta(reloj);

/** ¿Terminó la ronda del todo? Entonces ni se suma ni se une nadie (hasta la próxima ronda). */
const rondaCerrada = () => !prueba && leerReloj(reloj).estado === 'fin' && !enGracia(reloj);

/** Monedas de un regalo: el precio que manda TikTok, el del activador, el del Buscador o 1. */
function monedasDe(evento, activado) {
  const precio = Number(evento.diamantes)
    || (activado >= 0 ? equipos[activado].valor : 0)
    || Number(precios[String(evento.giftId ?? '')])
    || 1;
  return precio * Math.max(1, Number(evento.cantidad) || 1);
}

function alRegalo(evento) {
  if (rondaCerrada()) return;
  const clave = String(evento.uid || evento.usuario || '');
  if (!clave) return;
  const giftId = String(evento.giftId ?? '');
  const activado = equipos.findIndex((e) => e.giftId && e.giftId === giftId);

  // Si el panel no tenía la imagen del activador y TikTok la manda, se usa desde ya.
  if (activado >= 0 && evento.imagen && !equipos[activado].imagen) {
    equipos[activado].imagen = urlSegura(evento.imagen);
    armarEquipos();
  }

  let persona = personas.get(clave);
  if (activado >= 0 && equipoDe(persona) !== activado) {
    // Se une (o se cambia) al equipo de este activador.
    if (!persona) {
      if (personas.size >= MAX_PERSONAS) return;
      persona = { nombre: '', equipo: -1, aportes: cuatro() };
      personas.set(clave, persona);
    }
    const cambio = equipoDe(persona) >= 0;
    persona.equipo = activado;
    avisoUnion = {
      texto: `${evento.usuario || 'Alguien'} ${cambio ? 'se cambió a' : 'se unió a'} ${equipos[activado].nombre}`,
      hasta: Date.now() + AVISO_UNION_MS,
    };
    if (sonido) sonar({ frecuencia: 587, duracion: 0.2, subida: 1.3 });
  }
  if (equipoDe(persona) < 0) return; // no se ha unido a ningún equipo en juego: no suma
  persona.nombre = String(evento.usuario || persona.nombre || 'Alguien').slice(0, 24);

  if (cuentaAhora()) {
    const i = persona.equipo;
    const suma = monedasDe(evento, activado);
    const liderAntes = quienGana();
    puntos[i] += suma;
    persona.aportes[i] += suma;
    mostrarSuma(i, suma);
    // Sonido solo cuando cambia quién va ganando (una lluvia de rosas no debe sonar cada vez).
    if (sonido && quienGana() !== liderAntes && quienGana() !== null) sonar({ frecuencia: 660, duracion: 0.35 });
  }
  guardarRonda();
  pintar();
}


// -----------------------------------------------------------------------------
// 6. Arranque
// -----------------------------------------------------------------------------

iniciarWidget({
  cfg: leerConfig(),
  alConfig: aplicarConfig,
  alEvento(evento) {
    if (evento.tipo === 'regalo') alRegalo(evento);
  },
});

// El reloj se repinta con setInterval (no con requestAnimationFrame) para que siga
// aunque la página no se esté dibujando.
setInterval(pintarReloj, 200);
