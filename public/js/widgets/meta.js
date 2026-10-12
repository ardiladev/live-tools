// =============================================================================
// meta.js — Lógica del widget "Meta" (meta.html)
//
// Configuración en #c=… (la genera el panel):
//   u, k = usuario y clave · t = tipo (likes | follows | shares | monedas)
//   o = objetivo · ti = título · col = color (#rrggbb)
//   al = al alcanzar la meta (duplicar | reiniciar | nada) · s = sonido (1/0)
//
// El conteo empieza en 0 cada vez que se abre la fuente en OBS.
// Secciones: 1. Configuración · 2. Pintado · 3. Arranque
// =============================================================================

import { leerConfig, iniciarWidget, sonar } from '../comun.js';


// -----------------------------------------------------------------------------
// 1. Configuración
// -----------------------------------------------------------------------------

const cfg = leerConfig() || {};

// Qué cuenta cada tipo de meta. Para una meta nueva, se agrega una entrada aquí
// (y su vista en js/panel/vistas/metas.js).
const TIPOS = {
  likes:   { unidad: 'Likes',       cuenta: (e) => (e.tipo === 'like' ? e.cantidad : 0) },
  follows: { unidad: 'Seguidores',  cuenta: (e) => (e.tipo === 'follow' ? 1 : 0) },
  shares:  { unidad: 'Compartidos', cuenta: (e) => (e.tipo === 'share' ? 1 : 0) },
  // Ojo: TikTok casi nunca manda el precio del regalo; sin precio, el regalo suma 0.
  monedas: { unidad: 'Monedas',     cuenta: (e) => (e.tipo === 'regalo' ? e.diamantes * e.cantidad : 0) },
};

const tipo = TIPOS[cfg.t] ? cfg.t : 'likes';
const titulo = String(cfg.ti || 'Meta');
const alAlcanzar = cfg.al || 'nada';
const color = /^#[0-9a-f]{6}$/i.test(cfg.col) ? cfg.col : '#3aa0d8';
const PAUSA_CELEBRACION_MS = 3500; // tiempo con la barra llena antes de duplicar/reiniciar

let objetivo = Math.max(1, Number(cfg.o) || 100);
let actual = 0;


// -----------------------------------------------------------------------------
// 2. Pintado
// -----------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);
const formato = new Intl.NumberFormat('es-CO');
document.documentElement.style.setProperty('--color', color);

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
  if (cfg.s !== 0) sonar({ frecuencia: 660, duracion: 0.6 });
}


// -----------------------------------------------------------------------------
// 3. Arranque
// -----------------------------------------------------------------------------

pintar();

iniciarWidget({
  cfg,
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
