// =============================================================================
// activacion.js — Lógica del widget "Barras de activación" (activacion.html)
//
// De 2 a 4 barras, cada una con su regalo activador. Las reglas:
//   - Quien envía el activador de una barra queda unido a ella (ese regalo ya le suma).
//   - Desde ahí, CUALQUIER regalo de esa persona suma sus monedas a su barra.
//   - Si envía el activador de otra barra, se cambia: lo que ya sumó se queda donde estaba.
//   - Los regalos de quien no se ha unido a ninguna barra no suman.
// Las monedas solo suman con el reloj en marcha (y unos segundos de gracia al final, por los
// combos que se cuentan tarde); unirse sí se puede antes de iniciar. Al terminar, gana la barra
// con más monedas. La barra que va primera se ve llena y las demás en proporción a ella.
//
// A cada persona se la reconoce por el id de su cuenta (`uid`, ver comun.js); los regalos de
// prueba del panel no lo traen y se reconocen por el nombre.
//
// Configuración (la genera el panel; llega en #c=… o, con cambios en vivo, desde Supabase):
//   u, k = usuario y clave
//   eq = barras [{ n: nombre, g: id del regalo activador, v: monedas del activador (si TikTok no
//        manda el precio), c: color, img: imagen del regalo }] (de 2 a 4)
//   pr = precios del Buscador de regalos { giftId: monedas }, para los regalos que llegan sin
//        precio (si tampoco está ahí, el regalo suma 1)
//   ro = ronda (al cambiar, las monedas y los equipos vuelven a 0) · s = sonido (1/0)
//   t = reloj { e, d, fin, r } (ver js/reloj.js) · est = estilo visual (js/tema.js)
//
// La ronda (monedas, quién está en cada barra y quién aportó más) se guarda en este navegador:
// si OBS recarga la fuente, se conserva.
// Secciones: 1. Configuración · 2. Ronda guardada · 3. Pintado · 4. Reloj · 5. Regalos · 6. Arranque
// =============================================================================

import { leerConfig, iniciarWidget, sonar } from '../comun.js';
import { leerReloj, formatoReloj } from '../reloj.js';
import { prueba, leerGuardado, escribirGuardado, enGracia, relojCuenta, animarCifra } from '../juego.js';


// -----------------------------------------------------------------------------
// 1. Configuración
// -----------------------------------------------------------------------------

const MIN_BARRAS = 2;
const MAX_BARRAS = 4;
const RELLENO_MIN = 1.5;    // % mínimo de una barra con monedas (para que se note que tiene algo)
const CONTEO_MS = 500;      // duración de la animación del número
const AVISO_UNION_MS = 3500; // cuánto se ve "Fulano se unió a…"
const AVISO_FINAL_S = 5;    // segundos finales con "tic" de aviso
const MAX_PERSONAS = 5000;  // personas que se recuerdan por ronda (el guardado no crece sin fin)
const COLORES = ['#D4AF37', '#C9CDD4', '#B87333', '#8FB9A8'];
const ESTADOS = { listo: 'Lista', corre: 'En juego', pausa: 'En pausa', fin: 'Final' };

let barras = [];
let precios = {};
let sonido = true;
let ronda = null;
let reloj = { e: 'listo', d: 180 };
let claveGuardado = '';

// La ronda: monedas por barra y, por persona, su barra y lo que aportó a cada una. Se llevan
// siempre las 4 barras, aunque haya menos en juego: así no se pierde nada si el panel quita
// una barra a mitad de ronda y luego la vuelve a poner.
let puntos = [];
let personas = new Map(); // clave de la persona → { nombre, barra, aportes: [monedas por barra] }

const urlSegura = (texto) => (/^https?:\/\//i.test(String(texto || '')) ? String(texto) : '');

function normalizarBarra(b, i) {
  return {
    nombre: String(b?.n || `Barra ${i + 1}`).slice(0, 24),
    giftId: String(b?.g ?? '').trim(),
    valor: Math.max(0, Number(b?.v) || 0),
    color: /^#[0-9a-f]{6}$/i.test(b?.c) ? b.c : COLORES[i],
    imagen: urlSegura(b?.img),
  };
}

/** Aplica una configuración. Puede llegar en cualquier momento (cambios en vivo, reinicio, reloj). */
function aplicarConfig(cfg) {
  const lista = Array.isArray(cfg.eq) ? cfg.eq.slice(0, MAX_BARRAS) : [];
  while (lista.length < MIN_BARRAS) lista.push({});
  barras = lista.map(normalizarBarra);
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

  armarBarras();
  pintarReloj();
  pintar(false);
}

/** Monedas de las 4 barras, y lo que aportó cada persona a cada una (lo que falte, en 0). */
const cuatro = (lista) => Array.from({ length: MAX_BARRAS }, (_, i) => Math.max(0, Number(lista?.[i]) || 0));

function ajustarCantidad() {
  puntos = cuatro(puntos);
  for (const persona of personas.values()) persona.aportes = cuatro(persona.aportes);
}

/** Las monedas de las barras en juego. */
const enJuego = () => puntos.slice(0, barras.length);

/** Barra de una persona, o -1 si no tiene (o si su barra no está en juego: tiene que volver a unirse). */
const barraDe = (persona) => (persona && persona.barra >= 0 && persona.barra < barras.length ? persona.barra : -1);


// -----------------------------------------------------------------------------
// 2. Ronda guardada (para que una recarga de OBS no la borre)
// -----------------------------------------------------------------------------

const CLAVE_RONDA = 'live-tools:activacion:';

function restaurarRonda() {
  const guardado = leerGuardado(claveGuardado);
  if (guardado?.ro !== ronda) return; // la ronda empieza en 0
  if (Array.isArray(guardado.p)) puntos = cuatro(guardado.p);
  if (Array.isArray(guardado.per)) {
    for (const [clave, nombre, barra, aportes] of guardado.per) {
      if (!clave || !Array.isArray(aportes)) continue;
      personas.set(String(clave), { nombre: String(nombre || ''), barra: Number.isInteger(barra) ? barra : -1, aportes: cuatro(aportes) });
    }
  }
}

function guardarRonda() {
  const per = [...personas].map(([clave, p]) => [clave, p.nombre, p.barra, p.aportes]);
  escribirGuardado(claveGuardado, { ro: ronda, p: puntos, per });
}


// -----------------------------------------------------------------------------
// 3. Pintado
// -----------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);
const formato = new Intl.NumberFormat('es-CO');
let filas = []; // nodos de cada barra, en el mismo orden que `barras`

function ponerImagen(img, url) {
  if (img.getAttribute('src') !== url) {
    if (url) img.src = url;
    else img.removeAttribute('src');
  }
  img.hidden = !url;
}

/** Una fila por barra (solo se rehacen si cambia cuántas hay) con su nombre, color e imagen. */
function armarBarras() {
  const contenedor = $('barras');
  if (filas.length !== barras.length) {
    const plantilla = $('plantilla-barra').content.firstElementChild;
    filas = barras.map(() => {
      const nodo = plantilla.cloneNode(true);
      return {
        nodo,
        regalo: nodo.querySelector('.regalo'),
        inicial: nodo.querySelector('.inicial'),
        nombre: nodo.querySelector('.nombre'),
        miembros: nodo.querySelector('.miembros'),
        mejor: nodo.querySelector('.mejor'),
        relleno: nodo.querySelector('.relleno'),
        monedas: nodo.querySelector('.monedas'),
        mostrado: null,
        animacion: 0,
      };
    });
    contenedor.replaceChildren(...filas.map((f) => f.nodo));
  }
  contenedor.dataset.cantidad = barras.length;
  barras.forEach((b, i) => {
    const fila = filas[i];
    fila.nodo.style.setProperty('--color', b.color);
    fila.nombre.textContent = b.nombre;
    ponerImagen(fila.regalo, b.imagen);
    fila.inicial.textContent = b.imagen ? '' : b.nombre.charAt(0).toUpperCase();
  });
}

/** Cuántas personas hay en cada barra y quién aportó más a cada una. */
function resumenEquipos() {
  const miembros = barras.map(() => 0);
  const mejores = barras.map(() => null);
  for (const persona of personas.values()) {
    if (barraDe(persona) >= 0) miembros[persona.barra] += 1;
    mejores.forEach((mejor, i) => {
      const monedas = persona.aportes[i];
      if (monedas > 0 && (!mejor || monedas > mejor.monedas)) mejores[i] = { nombre: persona.nombre, monedas };
    });
  }
  return { miembros, mejores };
}

/** Índice de la barra que va ganando, o `null` si no hay monedas o hay empate arriba. */
function quienGana() {
  const lista = enJuego();
  const maximo = Math.max(0, ...lista);
  if (!maximo) return null;
  const primeras = lista.filter((p) => p === maximo).length;
  return primeras === 1 ? lista.indexOf(maximo) : null;
}

let avisoUnion = null; // { texto, hasta } mientras se muestra "Fulano se unió a…"

/** Rellenos, monedas, equipos y el aviso de abajo. Con `animar`, los números suben poco a poco. */
function pintar(animar = true) {
  const maximo = Math.max(0, ...enJuego());
  const { miembros, mejores } = resumenEquipos();
  const lider = quienGana();
  filas.forEach((fila, i) => {
    const parte = maximo ? (puntos[i] / maximo) * 100 : 0;
    fila.relleno.style.width = `${puntos[i] ? Math.max(RELLENO_MIN, parte) : 0}%`;
    fila.miembros.textContent = `👥 ${miembros[i]}`;
    fila.mejor.textContent = mejores[i] ? `⭐ ${mejores[i].nombre}` : '';
    fila.nodo.classList.toggle('gana', lider === i);
    animarCifra(fila, puntos[i], { animar, ms: CONTEO_MS, escribir: (valor) => { fila.monedas.textContent = formato.format(valor); } });
  });
  pintarAviso(lider);
}

function pintarAviso(lider = quienGana()) {
  const aviso = $('aviso');
  const { estado } = leerReloj(reloj);
  let texto;
  if (avisoUnion && Date.now() < avisoUnion.hasta) texto = avisoUnion.texto;
  else if (estado === 'fin') {
    texto = lider === null
      ? (Math.max(0, ...enJuego()) ? 'Terminó en empate' : 'Terminó la ronda')
      : `¡Ganó ${barras[lider].nombre} con ${formato.format(puntos[lider])} monedas!`;
  } else if (lider !== null) texto = `Va ganando ${barras[lider].nombre}`;
  else texto = Math.max(0, ...enJuego()) ? 'Empate' : 'Envía un regalo activador para unirte a una barra';
  aviso.textContent = texto;
  aviso.style.setProperty('--color', lider === null ? 'transparent' : barras[lider].color);
}

/** "+25" que sube desde la barra, y un golpe en su ícono. */
function mostrarSuma(i, suma) {
  const fila = filas[i];
  const flotante = document.createElement('span');
  flotante.className = 'suma';
  flotante.textContent = `+${formato.format(suma)}`;
  flotante.addEventListener('animationend', () => flotante.remove());
  fila.nodo.append(flotante);
  fila.nodo.classList.remove('golpe');
  void fila.nodo.offsetWidth; // reinicia la animación
  fila.nodo.classList.add('golpe');
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
function monedasDe(evento, activada) {
  const precio = Number(evento.diamantes)
    || (activada >= 0 ? barras[activada].valor : 0)
    || Number(precios[String(evento.giftId ?? '')])
    || 1;
  return precio * Math.max(1, Number(evento.cantidad) || 1);
}

function alRegalo(evento) {
  if (rondaCerrada()) return;
  const clave = String(evento.uid || evento.usuario || '');
  if (!clave) return;
  const giftId = String(evento.giftId ?? '');
  const activada = barras.findIndex((b) => b.giftId && b.giftId === giftId);

  // Si el panel no tenía la imagen del activador y TikTok la manda, se usa desde ya.
  if (activada >= 0 && evento.imagen && !barras[activada].imagen) {
    barras[activada].imagen = urlSegura(evento.imagen);
    armarBarras();
  }

  let persona = personas.get(clave);
  if (activada >= 0 && barraDe(persona) !== activada) {
    // Se une (o se cambia) a la barra de este activador.
    if (!persona) {
      if (personas.size >= MAX_PERSONAS) return;
      persona = { nombre: '', barra: -1, aportes: cuatro() };
      personas.set(clave, persona);
    }
    const cambio = barraDe(persona) >= 0;
    persona.barra = activada;
    avisoUnion = {
      texto: `${evento.usuario || 'Alguien'} ${cambio ? 'se cambió a' : 'se unió a'} ${barras[activada].nombre}`,
      hasta: Date.now() + AVISO_UNION_MS,
    };
    if (sonido) sonar({ frecuencia: 587, duracion: 0.2, subida: 1.3 });
  }
  if (barraDe(persona) < 0) return; // no se ha unido a ninguna barra en juego: no suma
  persona.nombre = String(evento.usuario || persona.nombre || 'Alguien').slice(0, 24);

  if (cuentaAhora()) {
    const i = persona.barra;
    const suma = monedasDe(evento, activada);
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
