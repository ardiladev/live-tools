// =============================================================================
// widgets/jefe/Monstruo.tsx — El monstruo del "Jefe del LIVE" (SVG, diseño propio)
//
// Una bestia de obsidiana con cuernos de oro y un NÚCLEO dorado en el pecho. Se va rompiendo
// a medida que la barra de vida baja:
//   etapa 1 (100–75 %) confiado: sonrisa con colmillos, ojos entrecerrados
//   etapa 2 (75–50 %)  molesto: dientes apretados, primera grieta, el núcleo se raja
//   etapa 3 (50–25 %)  herido: se le rompe un cuerno (la punta cae), ojo morado, curita, sudor
//   etapa 4 (25–0 %)   mareado: ojos en espiral, el otro cuerno roto, humo, el núcleo parpadea
//   vencido            K.O.: se desploma con ojos en X, el núcleo estalla en monedas y le
//                      giran estrellas
// Además: en pausa se duerme (zzz) y si se acaba el tiempo se burla (se ríe y rebota).
// Cada golpe lo hace retroceder con un destello y una chispa (más fuerte con regalos).
//
// Todo el dibujo es SVG sin texto (no cambia el texto del widget). Qué se ve en cada momento
// lo decide el CSS (monstruo.css) con data-etapa, data-cara y data-fase; las animaciones de
// golpe se reinician con la clase `golpe` (useReiniciarAnimacion). El oro sale de las variables
// del estilo del widget (--activo, --borde-color), así sigue al estilo elegido en el panel.
// Coordenadas: el cuerpo está centrado en x = 100; el suelo, en y ≈ 190.
// =============================================================================

import { useRef, type CSSProperties } from 'react';
import { useReiniciarAnimacion } from '../../hooks/useReiniciarAnimacion';
import type { FaseJefe } from './config';
import './monstruo.css';

export type EtapaMonstruo = 1 | 2 | 3 | 4;
type Cara = 'confiado' | 'molesto' | 'herido' | 'mareado' | 'ko' | 'risa' | 'dormido';

/** Etapa de daño según la fracción de vida que le queda (0 … 1). */
export function etapaDe(fraccionVida: number): EtapaMonstruo {
  if (fraccionVida > 0.75) return 1;
  if (fraccionVida > 0.5) return 2;
  if (fraccionVida > 0.25) return 3;
  return 4;
}

/** La cara manda la fase (vencido, escapó, pausa); si está peleando, la etapa. */
function caraDe(etapa: EtapaMonstruo, fase: FaseJefe): Cara {
  if (fase === 'vencido') return 'ko';
  if (fase === 'escapo') return 'risa';
  if (fase === 'pausa') return 'dormido';
  return (['confiado', 'molesto', 'herido', 'mareado'] as const)[etapa - 1] ?? 'confiado';
}

// Dónde salta la chispa de cada golpe (se turnan, sin azar: el azar del widget es para los números).
const IMPACTOS = [[70, 104], [132, 98], [88, 152], [120, 140], [100, 72]] as const;

// Monedas que salen del núcleo al vencerlo y esquirlas de la gema: [dx, dy] de cada una.
const MONEDAS = [[-62, -40], [-40, -70], [-12, -84], [18, -80], [46, -66], [66, -34], [-74, 6], [72, 10], [-30, 30], [34, 34]] as const;
const ESQUIRLAS = [[-44, -30], [46, -24], [-34, 40], [40, 38]] as const;

/** Hacia dónde sale una moneda o esquirla (variables CSS que usan sus animaciones). */
const rumbo = (dx: number, dy: number, i = 0): CSSProperties => ({ '--x': `${dx}px`, '--y': `${dy}px`, '--i': i } as CSSProperties);

/** Estrella de cinco puntas centrada en (cx, cy). */
function estrella(cx: number, cy: number, r: number): string {
  const puntos = Array.from({ length: 10 }, (_, k) => {
    const radio = k % 2 ? r * 0.45 : r;
    const angulo = (Math.PI / 5) * k - Math.PI / 2;
    return `${(cx + radio * Math.cos(angulo)).toFixed(1)},${(cy + radio * Math.sin(angulo)).toFixed(1)}`;
  });
  return `M${puntos.join('L')}z`;
}
// Cuatro estrellas en círculo alrededor de la cabeza caída (el CSS las hace girar en óvalo).
const ESTRELLAS = [[132, 40], [96, 76], [60, 40], [96, 4]].map(([x, y]) => estrella(x ?? 0, y ?? 0, 10));

export function Monstruo({ etapa, fase, golpes, fuerte }: {
  etapa: EtapaMonstruo;
  fase: FaseJefe;
  /** Cuántos golpes lleva (cada uno reinicia la animación de golpe). */
  golpes: number;
  /** El último golpe fue un regalo (retroceso y chispa más grandes). */
  fuerte: boolean;
}) {
  const raiz = useRef<HTMLDivElement>(null);
  useReiniciarAnimacion(raiz, 'golpe', golpes);
  const [ix, iy] = IMPACTOS[golpes % IMPACTOS.length] ?? IMPACTOS[0];
  const clases = ['monstruo', golpes > 0 && 'golpe', fuerte && 'fuerte'].filter(Boolean).join(' ');

  return (
    <div className={clases} ref={raiz} data-etapa={fase === 'vencido' ? 4 : etapa} data-fase={fase} data-cara={caraDe(etapa, fase)} aria-hidden="true">
      <svg viewBox="-14 -24 228 228" preserveAspectRatio="xMidYMax meet">
        <defs>
          <radialGradient id="mj-piel" cx="36%" cy="28%" r="78%">
            <stop offset="0" stopColor="#7350AE" />
            <stop offset=".5" stopColor="#3A2263" />
            <stop offset="1" stopColor="#170C27" />
          </radialGradient>
          <radialGradient id="mj-panza" cx="50%" cy="32%" r="72%">
            <stop offset="0" stopColor="#5E4192" />
            <stop offset="1" stopColor="#2B1948" />
          </radialGradient>
          <linearGradient id="mj-cuerno" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" className="mj-oro-hondo" />
            <stop offset=".55" className="mj-oro" />
            <stop offset="1" stopColor="#FFF6D8" />
          </linearGradient>
          <linearGradient id="mj-nucleo" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FFF8E1" />
            <stop offset=".45" className="mj-oro" />
            <stop offset="1" className="mj-oro-hondo" />
          </linearGradient>
          <radialGradient id="mj-halo">
            <stop offset="0" className="mj-oro" stopOpacity=".75" />
            <stop offset="1" className="mj-oro" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="mj-ojo" cx="50%" cy="42%" r="62%">
            <stop offset="0" stopColor="#FFFCEB" />
            <stop offset=".5" className="mj-oro" />
            <stop offset="1" stopColor="#7A4E00" />
          </radialGradient>
        </defs>

        {/* Sombra en el suelo */}
        <ellipse className="mj-sombra" cx="100" cy="190" rx="62" ry="8" />

        <g className="mj-figura">
          <g className="mj-tiembla">
          <g className="mj-respira">
            {/* ---------- Brazos (detrás del cuerpo) ---------- */}
            <g className="mj-brazo mj-brazo-izq">
              <path className="mj-piel mj-contorno" d="M42 104C24 108 10 126 12 144c1 10 10 14 18 8 6-6 10-18 16-28z" />
              <path className="mj-garra" d="M12 146l-8 4 9 1zM15 152l-6 6 9-3zM21 156l-3 7 7-6z" />
            </g>
            <g transform="translate(200 0) scale(-1 1)">
              <g className="mj-brazo mj-brazo-der">
                <path className="mj-piel mj-contorno" d="M42 104C24 108 10 126 12 144c1 10 10 14 18 8 6-6 10-18 16-28z" />
                <path className="mj-garra" d="M12 146l-8 4 9 1zM15 152l-6 6 9-3zM21 156l-3 7 7-6z" />
              </g>
            </g>

            {/* ---------- Cuernos: enteros, o rotos desde la etapa 3 (derecho) y 4 (izquierdo) ---------- */}
            <g className="mj-cuerno-izq-entero">
              <path className="mj-cuerno mj-contorno" d="M66 60C52 46 46 26 56 6c4 16 16 30 30 40z" />
              <path className="mj-anillo" d="M56 32q8-3 12 4M61 46q7-3 12 3" />
            </g>
            <path className="mj-cuerno mj-contorno mj-cuerno-izq-roto" d="M66 60c-6-6-10-12-12-18l5-2 3-6 4 5 6-2c4 4 8 7 14 9z" />
            <g className="mj-cuerno-der-entero">
              <path className="mj-cuerno mj-contorno" d="M134 60c14-14 20-34 10-54-4 16-16 30-30 40z" />
              <path className="mj-anillo" d="M144 32q-8-3-12 4M139 46q-7-3-12 3" />
            </g>
            <path className="mj-cuerno mj-contorno mj-cuerno-der-roto" d="M134 60c6-6 10-12 12-18l-5-2-3-6-4 5-6-2c-4 4-8 7-14 9z" />

            {/* ---------- Pies ---------- */}
            <ellipse className="mj-pie mj-contorno" cx="74" cy="184" rx="19" ry="9" />
            <ellipse className="mj-pie mj-contorno" cx="126" cy="184" rx="19" ry="9" />
            <path className="mj-dedos" d="M64 186v-4M72 188v-5M134 188v-5M142 186v-4" />

            {/* ---------- Cuerpo ---------- */}
            <path className="mj-piel mj-contorno" d="M100 40c42 0 70 32 71 74s-25 72-71 72-70-30-71-72S58 40 100 40z" />
            <path className="mj-borde-luz" d="M140 52c20 14 30 38 30 62" />
            <ellipse className="mj-brillo" cx="70" cy="70" rx="17" ry="10" transform="rotate(-32 70 70)" />
            <ellipse className="mj-panza" cx="100" cy="142" rx="44" ry="38" />
            <path className="mj-escamas" d="M68 128q32-9 64 0M64 144q36-9 72 0M68 160q32-8 64 0" />

            {/* ---------- Núcleo dorado: se raja con el daño y estalla al vencerlo ---------- */}
            <g className="mj-nucleo">
              <circle className="mj-halo" cx="100" cy="140" r="30" />
              <path className="mj-gema" d="M100 121l17 19-17 19-17-19z" />
              <path className="mj-faceta" d="M100 121v38M83 140h34M91 130l18 20M109 130l-18 20" />
              <path className="mj-raja mj-d2" d="M100 125l-4 10 5 6" />
              <path className="mj-raja mj-d3" d="M111 135l-6 10 4 6" />
              <path className="mj-raja mj-d4" d="M88 138l7 6-4 7" />
            </g>

            {/* ---------- Grietas con lava (se dibujan al aparecer) ---------- */}
            <g className="mj-d2">
              <polyline className="mj-grieta-fondo" pathLength={100} points="46,96 57,103 53,112 63,120 59,129" />
              <polyline className="mj-grieta" pathLength={100} points="46,96 57,103 53,112 63,120 59,129" />
            </g>
            <g className="mj-d3">
              <polyline className="mj-grieta-fondo" pathLength={100} points="154,96 145,109 155,119 147,132" />
              <polyline className="mj-grieta" pathLength={100} points="154,96 145,109 155,119 147,132" />
            </g>
            <g className="mj-d4">
              <polyline className="mj-grieta-fondo" pathLength={100} points="106,42 99,55 107,62 101,70" />
              <polyline className="mj-grieta" pathLength={100} points="106,42 99,55 107,62 101,70" />
              <polyline className="mj-grieta-fondo" pathLength={100} points="84,168 95,174 90,181" />
              <polyline className="mj-grieta" pathLength={100} points="84,168 95,174 90,181" />
            </g>

            {/* ---------- Cara ---------- */}
            {/* Ojo morado (etapa 3+), detrás de la cuenca izquierda */}
            <ellipse className="mj-moreton mj-d3" cx="78" cy="89" rx="22" ry="19" />
            <ellipse className="mj-cuenca" cx="78" cy="89" rx="17" ry="14" />
            <ellipse className="mj-cuenca" cx="122" cy="89" rx="17" ry="14" />

            {/* Confiado: ojos entrecerrados y sonrisa con colmillos */}
            <g className="mj-cara mj-cara-confiado">
              <ellipse className="mj-ojo" cx="79" cy="91" rx="10" ry="8" />
              <ellipse className="mj-ojo" cx="121" cy="91" rx="10" ry="8" />
              <ellipse className="mj-pupila" cx="80" cy="92" rx="2.4" ry="6" />
              <ellipse className="mj-pupila" cx="120" cy="92" rx="2.4" ry="6" />
              <path className="mj-parpado" d="M61 76h37l-3 12q-16-8-32-2zM139 76h-37l3 12q16-8 32-2z" />
              <path className="mj-ceja" d="M58 72l36 10M142 72l-36 10" />
              <path className="mj-boca" d="M66 112q34 24 68 0-34 12-68 0z" />
              <path className="mj-diente" d="M78 115l4 11 5-9zM113 117l5 9 4-11z" />
            </g>

            {/* Molesto: ojos abiertos, cejas en V, dientes apretados */}
            <g className="mj-cara mj-cara-molesto">
              <ellipse className="mj-ojo" cx="79" cy="90" rx="10" ry="9" />
              <ellipse className="mj-ojo" cx="121" cy="90" rx="10" ry="9" />
              <circle className="mj-pupila" cx="81" cy="91" r="3.2" />
              <circle className="mj-pupila" cx="119" cy="91" r="3.2" />
              <path className="mj-ceja" d="M58 66l36 16M142 66l-36 16" />
              <rect className="mj-dientes" x="74" y="108" width="52" height="17" rx="6" />
              <path className="mj-linea-dientes" d="M74 116.5h52M87 108v17M100 108v17M113 108v17" />
            </g>

            {/* Herido: un ojo cerrado a medias, cejas de preocupación, boca torcida */}
            <g className="mj-cara mj-cara-herido">
              <ellipse className="mj-ojo" cx="79" cy="93" rx="9" ry="3.5" />
              <ellipse className="mj-ojo" cx="121" cy="89" rx="10" ry="10" />
              <circle className="mj-pupila" cx="121" cy="90" r="2.6" />
              <path className="mj-ceja" d="M60 78l32-9M140 76l-32-9" />
              <path className="mj-boca" d="M76 116q12-8 24-2t24-2q-4 18-24 16-20 2-24-12z" />
              <path className="mj-diente" d="M84 115l4 7 3-8z" />
            </g>

            {/* Mareado: ojos en espiral, boca abierta con la lengua */}
            <g className="mj-cara mj-cara-mareado">
              <path className="mj-espiral" d="M79 89m-1 0a1 1 0 1 1 2 0 3 3 0 1 1-5-1 5 5 0 1 1 9 3 7 7 0 1 1-13-4" />
              <path className="mj-espiral" d="M121 89m-1 0a1 1 0 1 1 2 0 3 3 0 1 1-5-1 5 5 0 1 1 9 3 7 7 0 1 1-13-4" />
              <path className="mj-ceja" d="M60 74l32-10M140 74l-32-10" />
              <path className="mj-boca" d="M78 114q22-8 44 0-4 20-22 20t-22-20z" />
              <path className="mj-lengua" d="M91 127q9-7 18 0 0 11-9 11t-9-11z" />
              <path className="mj-diente" d="M86 114l3 7 4-8z" />
            </g>

            {/* K.O.: ojos en X y la lengua afuera */}
            <g className="mj-cara mj-cara-ko">
              <path className="mj-equis" d="M70 81l18 16M88 81L70 97M112 81l18 16M130 81l-18 16" />
              <path className="mj-boca-linea" d="M76 116q6-6 12 0t12 0 12 0 12 0" />
              <path className="mj-lengua" d="M106 118q4 16 13 13 7-4 1-14z" />
            </g>

            {/* Risa (se acabó el tiempo y escapó): ojos ^ ^ y carcajada */}
            <g className="mj-cara mj-cara-risa">
              <path className="mj-ojo-linea" d="M68 93q11-15 22 0M110 93q11-15 22 0" />
              <path className="mj-ceja" d="M60 70l32-4M140 70l-32-4" />
              <path className="mj-boca" d="M66 107h68q-6 33-34 33t-34-33z" />
              <path className="mj-diente" d="M79 107l4 9 4-9zM113 107l4 9 4-9z" />
              <ellipse className="mj-lengua" cx="100" cy="132" rx="14" ry="6" />
            </g>

            {/* Dormido (pausa): ojos cerrados y una burbuja */}
            <g className="mj-cara mj-cara-dormido">
              <path className="mj-ojo-linea" d="M68 91q11 9 22 0M110 91q11 9 22 0" />
              <path className="mj-ceja" d="M62 76h30M138 76h-30" />
              <ellipse className="mj-boca" cx="100" cy="118" rx="7" ry="5" />
              <circle className="mj-burbuja" cx="113" cy="121" r="6" />
            </g>

            {/* ---------- Curita y sudor (etapa 3+) ---------- */}
            <g className="mj-d3" transform="translate(76 54)">
              <rect className="mj-curita" x="-14" y="-4.5" width="28" height="9" rx="4.5" transform="rotate(35)" />
              <rect className="mj-curita" x="-14" y="-4.5" width="28" height="9" rx="4.5" transform="rotate(-35)" />
              <rect className="mj-curita-centro" x="-4" y="-4" width="8" height="8" rx="2" />
            </g>
            <path className="mj-sudor mj-d3" d="M146 64c0 0-7 9-7 13a7 7 0 0 0 14 0c0-4-7-13-7-13z" />

            {/* ---------- Destello del golpe (la silueta en blanco) ---------- */}
            <path className="mj-destello" d="M100 40c42 0 70 32 71 74s-25 72-71 72-70-30-71-72S58 40 100 40z" />
          </g>
          </g>
        </g>

        {/* ---------- Efectos (fuera del cuerpo) ---------- */}
        {/* Puntas de los cuernos que caen al romperse */}
        <path className="mj-cuerno mj-contorno mj-punta mj-punta-der" d="M146 42l-5-2-3-6-4 5-6-2c4-11 10-21 16-31 8 16 8 28 2 36z" />
        <path className="mj-cuerno mj-contorno mj-punta mj-punta-izq" d="M54 42l5-2 3-6 4 5 6-2C68 26 62 16 56 6c-8 16-8 28-2 36z" />

        {/* Humo (etapa 4) */}
        <g className="mj-humo mj-d4">
          <circle cx="104" cy="44" r="7" />
          <circle cx="58" cy="100" r="6" />
          <circle cx="150" cy="104" r="6" />
        </g>

        {/* Chispa del golpe: se turna entre varios puntos del cuerpo */}
        <g transform={`translate(${ix} ${iy})`}>
          <path className="mj-impacto" d="M0-22l5 13 14-6-8 12 14 4-14 4 8 12-14-6-5 13-5-13-14 6 8-12-14-4 14-4-8-12 14 6z" />
        </g>

        {/* Zzz (pausa) */}
        <path className="mj-zeta mj-zeta-1" d="M150 40h10l-10 12h10" />
        <path className="mj-zeta mj-zeta-2" d="M164 22h13l-13 15h13" />
        <path className="mj-zeta mj-zeta-3" d="M181 0h16l-16 18h16" />

        {/* Victoria: esquirlas del núcleo, monedas y estrellas que giran sobre la cabeza */}
        <g className="mj-esquirlas">
          {ESQUIRLAS.map(([dx, dy], i) => (
            <path key={i} className="mj-esquirla" style={rumbo(dx, dy)} d={['M100 128l-12 8 9 6z', 'M102 128l12 6-9 8z', 'M98 152l-11-6 4 12z', 'M102 152l11-6-4 12z'][i]} />
          ))}
        </g>
        <g className="mj-monedas">
          {MONEDAS.map(([dx, dy], i) => (
            <g key={i} className="mj-moneda" style={rumbo(dx, dy, i)}>
              <circle cx="100" cy="140" r="5.5" />
              <path d="M98.5 137v6M101.5 137v6" />
            </g>
          ))}
        </g>
        <g className="mj-estrellas">
          {ESTRELLAS.map((d, i) => <path key={i} d={d} />)}
        </g>
      </svg>
    </div>
  );
}
