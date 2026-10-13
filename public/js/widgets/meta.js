// =============================================================================
// meta.js — Lógica del widget "Meta" (meta.html)
//
// Configuración (la genera el panel; llega en #c=… o, con cambios en vivo, desde Supabase):
//   u, k = usuario y clave · t = tipo (likes | follows | shares | monedas)
//   o = objetivo · ti = título · col = color propio (#rrggbb; vacío = acento del estilo)
//   est = estilo visual (js/tema.js; lo aplica comun.js)
//   al = al alcanzar la meta (duplicar | reiniciar | nada) · s = sonido (1/0)
//
// El conteo empieza en 0 cada vez que se abre la fuente en OBS. Un cambio en vivo no lo
// borra (salvo que cambie el tipo de meta, porque entonces cuenta otra cosa).
// Secciones: 1. Configuración · 2. Pintado · 3. Arranque
// =============================================================================

import { leerConfig, iniciarWidget, sonar } from '../comun.js';


// -----------------------------------------------------------------------------
// 1. Configuración
// -----------------------------------------------------------------------------

// Qué cuenta cada tipo de meta. Para una meta nueva, se agrega una entrada aquí
// (y su vista en js/panel/vistas/metas.js).
const TIPOS = {
  likes:   { unidad: 'Likes',       cuenta: (e) => (e.tipo === 'like' ? e.cantidad : 0) },
  follows: { unidad: 'Seguidores',  cuenta: (e) => (e.tipo === 'follow' ? 1 : 0) },
  shares:  { unidad: 'Compartidos', cuenta: (e) => (e.tipo === 'share' ? 1 : 0) },
  // Ojo: TikTok no siempre manda el precio del regalo; sin precio, el regalo suma 0.
  monedas: { unidad: 'Monedas',     cuenta: (e) => (e.tipo === 'regalo' ? e.diamantes * e.cantidad : 0) },
};

const PAUSA_CELEBRACION_MS = 3500; // tiempo con la barra llena antes de duplicar/reiniciar

let tipo = 'likes';
let titulo = 'Meta';
let alAlcanzar = 'nada';
let sonido = true;
let objetivoConfigurado = 100; // el que puso la persona
let objetivo = 100;            // el vigente (puede haberse duplicado durante el LIVE)
let actual = 0;

/** Aplica una configuración. Puede llegar en cualquier momento (cambios en vivo). */
function aplicarConfig(cfg) {
  const nuevoTipo = TIPOS[cfg.t] ? cfg.t : 'likes';
  if (nuevoTipo !== tipo) actual = 0;
  tipo = nuevoTipo;
  titulo = String(cfg.ti || 'Meta');
  alAlcanzar = cfg.al || 'nada';
  sonido = cfg.s !== 0;
  // Color propio de la meta; sin él, la barra usa el acento del estilo (css/widgets/meta.css).
  if (/^#[0-9a-f]{6}$/i.test(cfg.col)) document.documentElement.style.setProperty('--color', cfg.col);
  else document.documentElement.style.removeProperty('--color');

  // Si la persona cambió la meta, manda la suya; si no, se respeta la que se duplicó en el LIVE.
  const nuevoObjetivo = Math.max(1, Number(cfg.o) || 100);
  if (nuevoObjetivo !== objetivoConfigurado) objetivo = nuevoObjetivo;
  objetivoConfigurado = nuevoObjetivo;
  pintar();
}


// -----------------------------------------------------------------------------
// 2. Pintado
// -----------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);
const formato = new Intl.NumberFormat('es-CO');

function pintar() {
  const porcentaje = Math.min(100, Math.floor((actual / objetivo) * 100));
  $('relleno').style.width = `${porcentaje}%`;
  $('porcentaje').textContent = `${porcentaje}%`;
  $('texto').textContent = `${titulo} - ${formato.format(actual)} / ${formato.format(objetivo)} ${TIPOS[tipo].unidad}`;
}

function celebrar() {
  const meta = $('meta');
  meta.classList.remove('lograda');
  void meta.offsetWidth; // reinicia la animación
  meta.classList.add('lograda');
  if (sonido) sonar({ frecuencia: 660, duracion: 0.6 });
}


// -----------------------------------------------------------------------------
// 3. Arranque
// -----------------------------------------------------------------------------

pintar();

iniciarWidget({
  cfg: leerConfig(),
  alConfig: aplicarConfig,
  alEvento(evento) {
    const suma = TIPOS[tipo].cuenta(evento);
    if (!suma) return;

    const antes = actual;
    actual += suma;
    pintar();

    if (antes < objetivo && actual >= objetivo) {
      celebrar();
      // Se deja ver la barra llena un momento antes de aplicar la acción.
      setTimeout(() => {
        if (alAlcanzar === 'duplicar') objetivo *= 2;
        if (alAlcanzar === 'reiniciar') actual = 0;
        pintar();
      }, PAUSA_CELEBRACION_MS);
    }
  },
});
