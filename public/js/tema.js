// =============================================================================
// tema.js — Estilo visual de los widgets (lo usan el panel y los widgets)
//
// El estilo es UNO para todos los widgets. El panel lo guarda (almacen.tema) y lo manda
// dentro de la configuración de cada widget con la clave `est` (por la URL o por Supabase).
// En el widget, aplicarTema() lo convierte en variables CSS (las mismas de css/aurea.css)
// y la ruleta lee además paletaRuleta() para dibujar el canvas.
//
// Claves (cortas, porque sin Supabase viajan en la URL):
//   m   modo del cristal: 'o' obsidiana (oscuro) | 'p' perla (claro)
//   op  opacidad del fondo, 0–100 (%)        bl  desenfoque, 0–24 (px)
//   ac  color de acento · ac2 fin del degradado · ag acento en degradado (1/0)
//   cb  color del borde · gr borde metálico en degradado (1/0) · bw grosor, 0–4 (px)
//   gl  resplandor, 0–40 (px)                ra  radio de las esquinas, 0–20 (px)
//   fu  fuente · ls espaciado entre letras, 0–25 (centésimas de em)
//   tt  mayúsculas: 'u' MAYÚSCULAS | 'c' Primera Letra | 'n' normal
//   ct  color del texto principal · ca color de lo activo (premio, brillo) · ci color de insignias
//
// Secciones: 1. Valores y presets · 2. Normalizar · 3. Colores · 4. Aplicar (widgets)
//            5. Paleta de la ruleta · 6. Utilidades de texto
// =============================================================================


// -----------------------------------------------------------------------------
// 1. Valores por defecto y presets
// -----------------------------------------------------------------------------

export const FUENTES = ['Montserrat', 'Inter', 'Outfit', 'Syncopate'];

export const PRESETS = {
  aurea: {
    nombre: 'Áurea Signature Gold',
    tema: {
      m: 'o', op: 55, bl: 12, ac: '#D4AF37', ac2: '#AA771C', ag: 1,
      cb: '#D4AF37', gr: 1, bw: 1, gl: 15, ra: 8,
      fu: 'Montserrat', ls: 12, tt: 'u', ct: '#F3DFA2', ca: '#F3DFA2', ci: '#D4AF37',
    },
  },
  perla: {
    nombre: 'Ethereal Pearl',
    tema: {
      m: 'p', op: 60, bl: 16, ac: '#D4AF37', ac2: '#AA771C', ag: 1,
      cb: '#C9A032', gr: 1, bw: 1.5, gl: 10, ra: 12,
      fu: 'Outfit', ls: 14, tt: 'u', ct: '#6E4C10', ca: '#8C6216', ci: '#C9A032',
    },
  },
  mono: {
    nombre: 'Monochrome Elegance',
    tema: {
      m: 'o', op: 60, bl: 14, ac: '#C0C4CC', ac2: '#6B7280', ag: 1,
      cb: '#C9CDD4', gr: 1, bw: 1, gl: 8, ra: 6,
      fu: 'Inter', ls: 10, tt: 'u', ct: '#E5E7EB', ca: '#FFFFFF', ci: '#9CA3AF',
    },
  },
  directo: {
    nombre: 'High-Contrast Broadcast',
    tema: {
      m: 'o', op: 100, bl: 0, ac: '#D4AF37', ac2: '#AA771C', ag: 0,
      cb: '#D4AF37', gr: 0, bw: 2, gl: 0, ra: 4,
      fu: 'Montserrat', ls: 8, tt: 'u', ct: '#FFD700', ca: '#FFFFFF', ci: '#D4AF37',
    },
  },
};

export const TEMA_POR_DEFECTO = PRESETS.aurea.tema;


// -----------------------------------------------------------------------------
// 2. Normalizar (nunca confiar en lo que llega: puede venir de una URL vieja o editada)
// -----------------------------------------------------------------------------

const HEX = /^#[0-9a-f]{6}$/i;
const limitar = (v, min, max, porDefecto) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : porDefecto;
};
const color = (v, porDefecto) => (HEX.test(v) ? v : porDefecto);
const bandera = (v, porDefecto) => (v === undefined ? porDefecto : (v ? 1 : 0));

/** Un tema completo y válido a partir de lo que llegue (o nada). */
export function normalizarTema(t = {}) {
  const d = TEMA_POR_DEFECTO;
  t = t && typeof t === 'object' ? t : {};
  return {
    m: t.m === 'p' ? 'p' : 'o',
    op: limitar(t.op, 0, 100, d.op),
    bl: limitar(t.bl, 0, 24, d.bl),
    ac: color(t.ac, d.ac),
    ac2: color(t.ac2, d.ac2),
    ag: bandera(t.ag, d.ag),
    cb: color(t.cb, d.cb),
    gr: bandera(t.gr, d.gr),
    bw: limitar(t.bw, 0, 4, d.bw),
    gl: limitar(t.gl, 0, 40, d.gl),
    ra: limitar(t.ra, 0, 20, d.ra),
    fu: FUENTES.includes(t.fu) ? t.fu : d.fu,
    ls: limitar(t.ls, 0, 25, d.ls),
    tt: ['u', 'c', 'n'].includes(t.tt) ? t.tt : d.tt,
    ct: color(t.ct, d.ct),
    ca: color(t.ca, d.ca),
    ci: color(t.ci, d.ci),
  };
}


// -----------------------------------------------------------------------------
// 3. Colores
// -----------------------------------------------------------------------------

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** rgba(…) de un color #rrggbb con transparencia `a` (0–1). */
export function rgba(hex, a) {
  const [r, g, b] = rgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.round(Math.min(1, Math.max(0, a)) * 1000) / 1000})`;
}

/** Mezcla dos colores #rrggbb: t = 0 → `a`, t = 1 → `b`. Devuelve #rrggbb. */
export function mezclar(a, b, t) {
  const ca = rgb(a);
  const cb = rgb(b);
  return `#${ca.map((v, i) => Math.round(v + (cb[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

/** Las tres paradas del filo metálico (claro en el medio) de un color de borde. */
export const parasFilo = (cb) => [cb, mezclar(cb, '#FFFFFF', 0.45), mezclar(cb, '#000000', 0.25)];

// Fondo del cristal según el modo: obsidiana (carbón) o perla (blanco).
const FONDO_MODO = { o: '#0F0F12', p: '#FFFFFF' };
const CONTRARIO_MODO = { o: '#FFFFFF', p: '#0F0F12' };
// Texto secundario: blanco sobre obsidiana, pizarra sobre perla.
const TEXTO_SEC = { o: '#FFFFFF', p: '#1A1A1A' };

/** Cuánto más (o menos) marcados que el estilo por defecto (55 %) van los rellenos traslúcidos. */
const factor = (t) => t.op / 55;


// -----------------------------------------------------------------------------
// 4. Aplicar el tema en un widget (variables CSS de css/aurea.css y widget.css)
// -----------------------------------------------------------------------------

const fuentesCargadas = new Set(['Montserrat']); // Montserrat ya viene en el <link> de cada widget

/** Agrega la hoja de Google Fonts de `fuente` una sola vez. */
function cargarFuente(fuente) {
  if (fuentesCargadas.has(fuente)) return;
  fuentesCargadas.add(fuente);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fuente)}:wght@300;400;500;600;700&display=swap`;
  document.head.append(link);
}

/** Promesa que se cumple cuando la fuente del tema está lista para el canvas. */
export function fuenteLista(fuente) {
  return document.fonts.load(`600 32px "${fuente}"`).catch(() => {});
}

let temaActual = normalizarTema();
export const tema = () => temaActual;

/**
 * Aplica el tema a la página del widget. Avisa con el evento 'tema-aplicado' (la ruleta lo
 * escucha para redibujar el canvas).
 */
export function aplicarTema(entrada) {
  const t = normalizarTema(entrada);
  temaActual = t;
  cargarFuente(t.fu);

  const f = factor(t);
  const filo = parasFilo(t.cb);
  const acento = t.ag ? `linear-gradient(135deg, ${t.ac}, ${t.ac2})` : t.ac;
  const variables = {
    '--cristal-oscuro': rgba(FONDO_MODO[t.m], t.op / 100),
    '--cristal-claro': rgba(CONTRARIO_MODO[t.m], 0.08 * f),
    '--desenfoque': t.bl > 0 ? `blur(${t.bl}px) saturate(120%)` : 'none',
    '--filo-oro': t.gr ? `linear-gradient(135deg, ${filo[0]} 0%, ${filo[1]} 45%, ${filo[2]} 100%)` : `linear-gradient(${t.cb}, ${t.cb})`,
    '--borde-ancho': `${t.bw}px`,
    '--borde-color': t.cb,
    '--resplandor': t.gl > 0 ? `0 0 ${t.gl}px ${rgba(t.cb, 0.25)}` : 'none',
    '--resplandor-activo': t.gl > 0 ? `0 0 ${Math.round(t.gl * 1.6)}px ${rgba(t.ca, 0.35)}` : 'none',
    '--radio': `${Math.round(t.ra / 2)}px`,
    '--radio-grande': `${t.ra}px`,
    '--fuente': `"${t.fu}", "Montserrat", "Segoe UI", system-ui, sans-serif`,
    '--espaciado-widget': `${t.ls / 100}em`,
    '--mayus': { u: 'uppercase', c: 'capitalize', n: 'none' }[t.tt],
    '--oro-texto': t.ct,
    '--texto-sec': TEXTO_SEC[t.m],
    '--activo': t.ca,
    '--acento': t.ac,
    '--acento-relleno': acento,
    '--insignia-fondo': `linear-gradient(135deg, ${rgba(t.ci, 0.15 * f)}, ${rgba(t.ci, 0.4 * f)})`,
    '--insignia-borde': rgba(t.ci, 0.6),
    '--sombra-texto': t.m === 'p'
      ? '0 1px 1px rgba(255, 255, 255, .55), 0 0 10px rgba(255, 255, 255, .35)'
      : '0 1px 2px rgba(0, 0, 0, .7), 0 0 14px rgba(0, 0, 0, .45)',
  };
  const estilo = document.documentElement.style;
  for (const [nombre, valor] of Object.entries(variables)) estilo.setProperty(nombre, valor);

  dispatchEvent(new CustomEvent('tema-aplicado', { detail: t }));
  return t;
}


// -----------------------------------------------------------------------------
// 5. Paleta de la ruleta (el canvas no lee variables CSS)
// -----------------------------------------------------------------------------

/** Colores, líneas y letra que usa js/widgets/ruleta.js para dibujar la rueda. */
export function paletaRuleta(t = temaActual) {
  const f = factor(t);
  return {
    // Sectores: base (el cristal del modo), alterno y acento. En obsidiana el alterno es un
    // velo blanco muy tenue; en perla, un blanco más ligero que la base (con uno oscuro, el
    // texto oscuro del modo perla no se leería).
    base: rgba(FONDO_MODO[t.m], t.op / 100),
    alterno: t.m === 'p' ? rgba('#FFFFFF', (t.op / 100) * 0.55) : rgba('#FFFFFF', Math.min(1, 0.08 * f)),
    acento: [rgba(t.ac, Math.min(1, 0.15 * f)), rgba(t.ag ? t.ac2 : t.ac, Math.min(1, 0.4 * f))],
    texto: t.ct,
    textoSec: TEXTO_SEC[t.m],
    sombra: t.m === 'p' ? 'rgba(255, 255, 255, .6)' : 'rgba(0, 0, 0, .7)',
    filo: t.gr ? parasFilo(t.cb) : [t.cb, t.cb, t.cb],
    tenue: rgba(t.cb, 0.45),
    grosor: t.bw,
    resplandor: t.gl,
    colorResplandor: rgba(t.cb, 0.35),
    centro: rgba(FONDO_MODO[t.m], Math.max(0.7, t.op / 100)),
    // Facetas de la gema del centro: del color del borde, aclarado y oscurecido.
    gema: [0.7, 0, 0.45, -0.35, 0.6, -0.2, 0.3, -0.5].map((k) =>
      (k >= 0 ? mezclar(t.cb, '#FFFFFF', k) : mezclar(t.cb, '#000000', -k))),
    fuente: t.fu,
    espaciado: t.ls / 100,
    transformar: (texto) => transformarTexto(texto, t.tt),
  };
}


// -----------------------------------------------------------------------------
// 6. Utilidades de texto
// -----------------------------------------------------------------------------

/** Aplica la opción de mayúsculas a un texto (para el canvas, que no tiene text-transform). */
export function transformarTexto(texto, tt) {
  if (tt === 'u') return texto.toUpperCase();
  if (tt === 'c') return texto.replace(/(^|\s)(\p{L})/gu, (_, espacio, letra) => espacio + letra.toUpperCase());
  return texto;
}
