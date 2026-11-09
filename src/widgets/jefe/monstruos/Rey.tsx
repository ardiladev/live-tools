// =============================================================================
// widgets/jefe/monstruos/Rey.tsx — Rey del abismo (amenaza 5: legendario)
//
// Un rey demonio que flota envuelto en un aura de fuego oscuro: túnica, hombreras de oro con
// púas, cuernos enormes, corona y un orbe mágico en cada mano. La gema del núcleo cuelga de
// una cadena sobre el pecho.
//   etapa 1 confiado: ojos rojos rasgados y una sonrisa encendida llena de dientes
//   etapa 2 molesto: ruge con colmillos; la corona se le tuerce y la cara se raja
//   etapa 3 herido: se le parte el cuerno izquierdo (la punta cae), se apaga un orbe, el aura
//                   se debilita
//   etapa 4 mareado: el aura parpadea, la túnica se raja, humo
//   vencido: se le cae la corona
// Estilos en la sección 5 de monstruos.css.
// =============================================================================

import { espiral, Grieta, Nucleo, type DibujoMonstruo } from './comun';

const AURA = 'M100-14c8 18 12 24 22 28 4-12 12-18 20-22-2 16 4 30 16 38 6-8 14-12 22-14-8 18-6 36 4 50-8 4-14 12-16 24 10 10 16 26 14 44-10-8-18-12-26-12 8 18 10 38 4 54H40c-6-16-4-36 4-54-8 0-16 4-26 12-2-18 4-34 14-44-2-12-8-20-16-24 10-14 12-32 4-50 8 2 16 6 22 14 12-8 18-22 16-38 8 4 16 10 20 22 10-4 14-10 22-28z';
const TUNICA = 'M100 50c40 0 58 40 64 80l12 56-24-10-16 12-18-12-18 14-18-14-18 12-16-12-24 10 12-56c6-40 24-80 64-80z';
const CABEZA = 'M100 10c22 0 36 16 36 36 0 18-10 30-22 36l-14 6-14-6c-12-6-22-18-22-36 0-20 14-36 36-36z';
const CUERNO = 'M76 22C60 18 40 22 30 12 22 4 18-6 18-16c10 14 20 18 34 18 12 0 22 4 28 10z';
const CORONA = 'M76 14l-4-22 12 12 8-18 8 18 8-18 8 18 12-12-4 22z';
const HOMBRERA = 'M38 88c2-20 18-32 40-30l-4 14 8 6-14 6c-10-2-20 0-30 4z';

function Brazo({ lado }: { lado: 'izq' | 'der' }) {
  return (
    <g className={`ry-brazo ry-brazo-${lado}`}>
      <path className="ry-tunica mj-contorno" d="M52 84C36 96 28 114 26 132l18 4c4-14 10-26 20-36z" />
      <path className="ry-mano mj-contorno" d="M24 134c-2 8 2 14 10 14s12-6 10-14z" />
      <path className="ry-garras" d="M24 136l-6-4M28 132l-3-7M38 132l2-7M44 136l6-4" />
      <g className={`ry-orbe ry-orbe-${lado}`}>
        <circle className="ry-orbe-luz" cx="34" cy="116" r="11" />
        <circle className="ry-orbe-anillo" cx="34" cy="116" r="15" />
      </g>
      {lado === 'der' && (
        <g className="ry-orbe-humo mj-d3">
          <circle cx="34" cy="122" r="4" />
          <circle cx="36" cy="112" r="3" />
        </g>
      )}
    </g>
  );
}

function Corona({ clase }: { clase: string }) {
  return (
    <g className={clase}>
      <path className="mj-cuerno mj-contorno" d={CORONA} />
      <rect className="mj-cuerno mj-contorno" x="74" y="12" width="52" height="7" rx="2" />
      <circle className="ry-joya" cx="100" cy="15.5" r="3" />
      <circle className="ry-joya" cx="84" cy="15.5" r="2" />
      <circle className="ry-joya" cx="116" cy="15.5" r="2" />
    </g>
  );
}

function Cuerpo() {
  return (
    <>
      <defs>
        <radialGradient id="ry-aura" cx="50%" cy="62%" r="60%">
          <stop offset="0" stopColor="#1A0630" stopOpacity="0" />
          <stop offset=".55" stopColor="#5B1C9A" stopOpacity=".5" />
          <stop offset="1" stopColor="#B266FF" stopOpacity=".85" />
        </radialGradient>
        <linearGradient id="ry-tunica" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#43245F" />
          <stop offset="1" stopColor="#120818" />
        </linearGradient>
        <radialGradient id="ry-piel" cx="40%" cy="30%" r="80%">
          <stop offset="0" stopColor="#56307A" />
          <stop offset="1" stopColor="#170A22" />
        </radialGradient>
        <linearGradient id="ry-cuerno" x1="1" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#3B2A4D" />
          <stop offset=".7" stopColor="#140A1C" />
          <stop offset="1" className="mj-oro" />
        </linearGradient>
        <linearGradient id="ry-ojo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFE6EB" />
          <stop offset=".5" stopColor="#FF2E58" />
          <stop offset="1" stopColor="#7A0020" />
        </linearGradient>
        <radialGradient id="ry-orbe" cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#F6E6FF" />
          <stop offset=".5" stopColor="#A64DFF" />
          <stop offset="1" stopColor="#36085F" />
        </radialGradient>
      </defs>

      {/* ---------- Aura de fuego oscuro (detrás de todo) ---------- */}
      <path className="ry-aura" d={AURA} />

      {/* ---------- Cuernos (detrás de la cabeza): el izquierdo se parte en la etapa 3 ---------- */}
      <path className="ry-cuerno mj-contorno ry-cuerno-entero" d={CUERNO} />
      <path className="ry-cuerno mj-contorno ry-cuerno-roto" d="M76 22C64 19 52 20 44 16l2-6-6-2 4-5c8 3 16 4 24 4 8 0 14 3 18 8z" />
      <path className="ry-cuerno mj-contorno" d={CUERNO} transform="translate(200 0) scale(-1 1)" />

      {/* ---------- Túnica, brazos (delante, con los orbes) y hombreras ---------- */}
      <path className="ry-tunica mj-contorno" d={TUNICA} />
      <path className="ry-ribete" d="M100 96v88M66 100l-16 74M134 100l16 74" />
      <Brazo lado="izq" />
      <g transform="translate(200 0) scale(-1 1)"><Brazo lado="der" /></g>
      <path className="mj-cuerno mj-contorno" d={HOMBRERA} />
      <path className="mj-cuerno mj-contorno" d="M44 74l-14-14 20 6zM58 64l-4-20 12 16z" />
      <g transform="translate(200 0) scale(-1 1)">
        <path className="mj-cuerno mj-contorno" d={HOMBRERA} />
        <path className="mj-cuerno mj-contorno" d="M44 74l-14-14 20 6zM58 64l-4-20 12 16z" />
      </g>
      <path className="ry-cadena" d="M68 82l32 38M132 82l-32 38" />
      <Nucleo />

      {/* ---------- Cabeza y corona ---------- */}
      <path className="ry-piel mj-contorno" d={CABEZA} />
      <path className="mj-trazo" strokeWidth="2" d="M70 54l10 6M130 54l-10 6M100 24v8" />
      <Corona clase="ry-corona" />

      {/* ---------- Caras (ojos en (86, 44) y (114, 44)) ---------- */}
      <g className="mj-cara mj-cara-confiado">
        <path className="ry-ojo" d="M74 42l22 4-4 5-16-2zM126 42l-22 4 4 5 16-2z" />
        <path className="mj-trazo" strokeWidth="5" d="M70 34l28 8M130 34l-28 8" />
        <path className="ry-boca" d="M78 62q22 16 44 0-22 8-44 0z" />
        <path className="mj-trazo" strokeWidth="1.6" d="M82 64l4 4 4-3 4 4 4-3 4 4 4-3 4 4 4-3 4 4" />
      </g>

      <g className="mj-cara mj-cara-molesto">
        <path className="ry-ojo" d="M74 44q11-10 22 0-11 7-22 0zM104 44q11-10 22 0-11 7-22 0z" />
        <path className="mj-trazo" strokeWidth="6" d="M70 30l28 12M130 30l-28 12" />
        <path className="ry-boca" d="M82 60h36q-2 18-18 18t-18-18z" />
        <path className="mj-diente" d="M86 60l3 8 4-8zM107 60l4 8 3-8z" />
      </g>

      <g className="mj-cara mj-cara-herido">
        <ellipse className="ry-ojo-apagado" cx="86" cy="46" rx="6" ry="2" />
        <path className="ry-raja-ojo" d="M80 32l8 12-4 6 6 10" />
        <path className="ry-ojo" d="M104 44q11-10 22 0-11 7-22 0z" />
        <path className="mj-trazo" strokeWidth="5" d="M72 38l26-4M130 32l-26 8" />
        <path className="ry-trazo-brillo" d="M84 68l6-3 6 3 6-3 6 3 6-3 6 3" />
      </g>

      <g className="mj-cara mj-cara-mareado">
        <path className="mj-espiral" d={espiral(86, 44)} />
        <path className="mj-espiral" d={espiral(114, 44)} />
        <ellipse className="ry-boca" cx="100" cy="66" rx="6" ry="4" />
      </g>

      <g className="mj-cara mj-cara-dolor">
        <path className="ry-ojo-linea" d="M77 38l15 6-15 6M123 38l-15 6 15 6" />
        <path className="ry-boca" d="M80 58h40q-3 18-20 18t-20-18z" />
        <path className="mj-diente" d="M85 58l3 8 4-8zM108 58l4 8 3-8z" />
      </g>

      <g className="mj-cara mj-cara-ko">
        <path className="mj-equis" d="M79 37l14 14M93 37l-14 14M107 37l14 14M121 37l-14 14" />
        <path className="mj-trazo" strokeWidth="3" d="M86 67h28" />
      </g>

      <g className="mj-cara mj-cara-risa">
        <path className="ry-ojo-linea" d="M74 47q11-11 22 0M104 47q11-11 22 0" />
        <path className="ry-boca" d="M74 58h52q-4 24-26 24t-26-24z" />
        <path className="mj-diente" d={`M80 58${'l4 6 4-6'.repeat(5)}z`} />
      </g>

      <g className="mj-cara mj-cara-dormido">
        <path className="ry-ojo-dormido" d="M76 44q10 5 20 0M104 44q10 5 20 0" />
        <path className="mj-trazo" strokeWidth="3" d="M92 67h16" />
      </g>

      {/* ---------- Grietas que brillan ---------- */}
      <Grieta clase="mj-d2" puntos={['124,50 116,58 122,66 118,74']} />
      <Grieta clase="mj-d3" puntos={['58,118 68,128 62,140 70,150']} />
      <Grieta clase="mj-d4" puntos={['138,108 148,122 142,134 150,146', '84,24 90,32 86,38']} />
    </>
  );
}

/** La punta del cuerno que cae (etapa 3) y la corona que se cae al vencerlo. */
function Fuera() {
  return (
    <>
      <path className="ry-cuerno mj-contorno mj-punta ry-punta" d="M44 16C34 12 24 4 20-6c-2-4-2-8-2-10 10 14 20 18 34 18l-4 5 6 2-2 6z" />
      <Corona clase="mj-punta ry-corona-cae" />
    </>
  );
}

export const rey: DibujoMonstruo = {
  Cuerpo,
  Fuera,
  silueta: `${TUNICA}${CABEZA}`,
  cabeza: [100, 40],
  humo: [[100, 8], [40, 100], [160, 100]],
  impactos: [[68, 110], [134, 104], [86, 160], [118, 146], [100, 40]],
};
