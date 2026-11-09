// =============================================================================
// widgets/jefe/monstruos/Dragon.tsx — Dragón de brasas (amenaza 4: temible)
//
// Un dragón rojo de frente, con alas abiertas que aletean, cuernos de oro, panza de placas y
// la gema del núcleo en el pecho. Echa humo por la nariz y lo rodean brasas.
//   etapa 1 confiado: ojos de reptil entrecerrados, media sonrisa con un colmillo
//   etapa 2 molesto: gruñe enseñando los dientes; arañazos en la panza y una grieta
//   etapa 3 herido: se le rasga el ala izquierda y se le parte el cuerno derecho (la punta cae)
//   etapa 4 mareado: las alas caen, más grietas, humo
//   escapó: se ríe con fuego en la garganta
// Estilos en la sección 4 de monstruos.css.
// =============================================================================

import { espiral, Grieta, Nucleo, type DibujoMonstruo } from './comun';

const ALA = 'M78 98C62 70 32 40-6 16c6 14 8 28 4 40 8-4 14-2 18 4 0 10-2 20-8 28 10-2 18 2 22 10 0 10-4 18-10 24 12-2 22 4 28 14 4-14 10-26 28-38z';
const ALA_ROTA = 'M78 98C62 70 32 40-6 16c6 14 8 28 4 40 8-4 14-2 18 4l14 10-6 8 14 6-8 6 12 6c0 10-4 18-10 24 12-2 22 4 28 14 4-14 10-26 28-38z';
const HUESOS = 'M76 96L-2 56M72 102L8 88M70 110L20 122';
const BRAZO = 'M62 116c-12 4-18 16-16 26 6 3 13-1 16-7z';
const CABEZA = 'M100 6c26 0 42 16 44 36 1 12-4 22-12 28-8 8-20 12-32 12s-24-4-32-12c-8-6-13-16-12-28 2-20 18-36 44-36z';
const CUERPO = 'M100 72c36 0 60 34 60 72 0 30-20 44-60 44s-60-14-60-44c0-38 24-72 60-72z';
// Fila de dientes (seis) para el gruñido.
const DIENTES = `M82 70${'l3 5 3-5'.repeat(6)}z`;

function Ala({ lado }: { lado: 'izq' | 'der' }) {
  return (
    <g className={`dr-ala dr-ala-${lado}`}>
      <path className="dr-membrana mj-contorno dr-ala-entera" d={ALA} />
      {lado === 'izq' && <path className="dr-membrana mj-contorno dr-ala-rota" d={ALA_ROTA} />}
      <path className="mj-trazo" strokeWidth="2.4" d={HUESOS} />
      <path className="dr-garra" d="M-6 16l-4-8 8 4z" />
    </g>
  );
}

function Cuerpo() {
  return (
    <>
      <defs>
        <radialGradient id="dr-escamas" cx="38%" cy="28%" r="80%">
          <stop offset="0" stopColor="#E0475A" />
          <stop offset=".5" stopColor="#931A2B" />
          <stop offset="1" stopColor="#3E0812" />
        </radialGradient>
        <linearGradient id="dr-ala" x1="1" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#7A1424" />
          <stop offset="1" stopColor="#3A0710" />
        </linearGradient>
        <linearGradient id="dr-panza" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F8D686" />
          <stop offset="1" stopColor="#C2772C" />
        </linearGradient>
        <linearGradient id="dr-ojo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFF6B8" />
          <stop offset=".55" stopColor="#FF9A12" />
          <stop offset="1" stopColor="#B42000" />
        </linearGradient>
        <radialGradient id="dr-fuego" cx="50%" cy="30%" r="70%">
          <stop offset="0" stopColor="#FFF4B0" />
          <stop offset=".5" stopColor="#FF8A1E" />
          <stop offset="1" stopColor="#B81D06" />
        </radialGradient>
      </defs>

      {/* ---------- Alas y cola (detrás del cuerpo) ---------- */}
      <Ala lado="izq" />
      <g transform="translate(200 0) scale(-1 1)"><Ala lado="der" /></g>
      <path className="dr-piel mj-contorno" d="M136 174c24 8 44 2 54-14 3 10-1 22-10 28-14 8-32 6-46 0z" />
      <path className="mj-cuerno mj-contorno" d="M186 162l16-10-3 18z" />

      {/* ---------- Pies ---------- */}
      <ellipse className="dr-piel mj-contorno" cx="72" cy="184" rx="18" ry="8" />
      <ellipse className="dr-piel mj-contorno" cx="128" cy="184" rx="18" ry="8" />
      <path className="dr-garra" d="M56 186l-6 3 8 0zM64 189l-3 4 7-2zM144 186l6 3-8 0zM136 189l3 4-7-2z" />

      {/* ---------- Cuerpo y panza de placas ---------- */}
      <path className="dr-piel mj-contorno" d={CUERPO} />
      <path className="dr-panza mj-contorno" d="M100 98c20 0 32 20 32 46 0 26-12 38-32 38s-32-12-32-38c0-26 12-46 32-46z" />
      <path className="dr-placas" d="M74 118h52M70 134h60M71 150h58M76 166h48" />
      <path className="dr-aranazo mj-d2" d="M80 112l14 22M88 108l14 22M96 106l14 22" />
      <Nucleo />

      {/* Bracitos */}
      <path className="dr-piel mj-contorno" d={BRAZO} />
      <path className="dr-piel mj-contorno" d={BRAZO} transform="translate(200 0) scale(-1 1)" />
      <path className="dr-garra" d="M46 142l-5 5 7-1zM51 146l-2 6 5-4zM154 142l5 5-7-1zM149 146l2 6-5-4z" />

      {/* ---------- Cuernos: el derecho se parte en la etapa 3 ---------- */}
      <path className="mj-cuerno mj-contorno" d="M70 24C56 14 50-2 54-18c4 14 14 24 28 30z" />
      <path className="mj-cuerno mj-contorno dr-cuerno-entero" d="M130 24c14-10 20-26 16-42-4 14-14 24-28 30z" />
      <path className="mj-cuerno mj-contorno dr-cuerno-roto" d="M130 24c4-4 7-9 9-14h-5l-2-5-4 4-5-2c-3 3-6 4-10 5z" />

      {/* ---------- Cabeza ---------- */}
      <path className="dr-piel mj-contorno" d="M58 34l-20-8 8 12-12 4 24 8zM142 34l20-8-8 12 12 4-24 8z" />
      <path className="dr-piel mj-contorno" d={CABEZA} />
      <path className="mj-cuerno mj-contorno" d="M93 9l7-13 7 13z" />
      <path className="dr-hocico mj-contorno" d="M100 50c18 0 28 8 28 18 0 10-12 16-28 16s-28-6-28-16c0-10 10-18 28-18z" />
      <ellipse className="mj-cuenca" cx="92" cy="60" rx="3" ry="2" />
      <ellipse className="mj-cuenca" cx="108" cy="60" rx="3" ry="2" />
      <g className="dr-humito">
        <circle cx="91" cy="55" r="3" />
        <circle cx="109" cy="55" r="3" />
      </g>

      {/* ---------- Caras (ojos en (82, 38) y (118, 38)) ---------- */}
      <g className="mj-cara mj-cara-confiado">
        <path className="dr-ojo" d="M70 38q12-10 24 0-12 6-24 0zM106 38q12-10 24 0-12 6-24 0z" />
        <ellipse className="mj-pupila" cx="83" cy="37" rx="1.6" ry="4" />
        <ellipse className="mj-pupila" cx="117" cy="37" rx="1.6" ry="4" />
        <path className="mj-trazo" strokeWidth="5" d="M66 30l30 8M134 30l-30 8" />
        <path className="mj-trazo" strokeWidth="3" d="M84 76q16 6 30-4" />
        <path className="mj-diente" d="M107 75l3 7 3-8z" />
      </g>

      <g className="mj-cara mj-cara-molesto">
        <path className="dr-ojo" d="M70 38q12-13 24 0-12 8-24 0zM106 38q12-13 24 0-12 8-24 0z" />
        <ellipse className="mj-pupila" cx="82" cy="37" rx="1.8" ry="5" />
        <ellipse className="mj-pupila" cx="118" cy="37" rx="1.8" ry="5" />
        <path className="mj-trazo" strokeWidth="6" d="M66 25l30 11M134 25l-30 11" />
        <path className="mj-boca" d="M80 70h40q-4 12-20 12t-20-12z" />
        <path className="mj-diente" d={DIENTES} />
      </g>

      <g className="mj-cara mj-cara-herido">
        <path className="mj-trazo" strokeWidth="3.5" d="M70 38q12 5 24 0" />
        <path className="dr-cicatriz" d="M74 26l16 24" />
        <path className="dr-ojo" d="M106 38q12-13 24 0-12 8-24 0z" />
        <ellipse className="mj-pupila" cx="118" cy="37" rx="1.8" ry="5" />
        <path className="mj-trazo" strokeWidth="5" d="M66 30l28-3M134 26l-28 6" />
        <path className="mj-trazo" strokeWidth="3" d="M84 76q8-5 16 0t16 0" />
      </g>

      <g className="mj-cara mj-cara-mareado">
        <path className="mj-espiral" d={espiral(82, 38)} />
        <path className="mj-espiral" d={espiral(118, 38)} />
        <ellipse className="mj-boca" cx="100" cy="75" rx="8" ry="5" />
        <path className="mj-lengua" d="M97 78h6v8l4 6-6-3-1 3-1-3-6 3 4-6z" />
      </g>

      <g className="mj-cara mj-cara-ko">
        <path className="mj-equis" d="M74 30l16 16M90 30l-16 16M110 30l16 16M126 30l-16 16" />
        <path className="mj-trazo" strokeWidth="3" d="M84 76h32" />
        <path className="mj-lengua" d="M104 77v9l3 5-4-2-1 3-1-3-4 2 3-5v-9z" />
      </g>

      <g className="mj-cara mj-cara-risa">
        <path className="mj-ojo-linea" d="M70 40q12-12 24 0M106 40q12-12 24 0" />
        <path className="mj-boca dr-garganta" d="M78 68h44q-4 16-22 16t-22-16z" />
        <path className="mj-diente" d="M82 68l3 7 4-7zM111 68l4 7 3-7z" />
      </g>

      <g className="mj-cara mj-cara-dormido">
        <path className="mj-trazo" strokeWidth="3.5" d="M70 38q12 6 24 0M106 38q12 6 24 0" />
        <path className="mj-trazo" strokeWidth="3" d="M88 76q12 4 24 0" />
      </g>

      {/* ---------- Grietas con fuego ---------- */}
      <Grieta clase="mj-d2" puntos={['48,118 58,126 54,136 62,144']} />
      <Grieta clase="mj-d3" puntos={['124,14 118,24 124,30 120,38']} />
      <Grieta clase="mj-d4" puntos={['148,136 138,146 144,156', '64,164 74,172 70,182']} />
    </>
  );
}

/** La punta del cuerno que cae (etapa 3) y las brasas que suben alrededor. */
function Fuera() {
  return (
    <>
      <path className="mj-cuerno mj-contorno mj-punta dr-punta" d="M139 10h-5l-2-5-4 4-5-2c6-8 12-16 16-25 3 10 2 20 0 28z" />
      <g className="dr-brasas">
        <circle cx="30" cy="176" r="2.4" />
        <circle cx="168" cy="170" r="2" />
        <circle cx="52" cy="186" r="1.8" />
        <circle cx="150" cy="188" r="2.6" />
        <circle cx="12" cy="150" r="1.6" />
      </g>
    </>
  );
}

export const dragon: DibujoMonstruo = {
  Cuerpo,
  Fuera,
  silueta: `${CABEZA}${CUERPO}`,
  cabeza: [100, 36],
  humo: [[100, 10], [46, 120], [154, 120]],
  impactos: [[64, 112], [136, 108], [86, 160], [118, 146], [100, 30]],
};
