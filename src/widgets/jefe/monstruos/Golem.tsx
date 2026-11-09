// =============================================================================
// widgets/jefe/monstruos/Golem.tsx — Gólem de piedra (amenaza 3: peligroso)
//
// Un gólem de roca con musgo, puños enormes y runas que brillan con el color del estilo. La
// gema del núcleo va en el pecho, dentro de un anillo de runas.
//   etapa 1 confiado: ojos rasgados encendidos y media sonrisa de piedra
//   etapa 2 molesto: dientes de piedra y la primera grieta encendida
//   etapa 3 herido: se le parte el hombro derecho (la roca cae), un ojo se apaga
//   etapa 4 mareado: grietas en la cabeza y el brazo, le caen piedritas, polvo
// Estilos en la sección 3 de monstruos.css.
// =============================================================================

import { espiral, Grieta, Nucleo, type DibujoMonstruo } from './comun';

const BRAZO = 'M28 84L58 90 54 136 22 138z';
const SILUETA = 'M70 18h60l8 20-4 28h16l20 50-16 46H46l-16-46 20-50h16l-4-28z';

function Brazo({ lado }: { lado: 'izq' | 'der' }) {
  return (
    <g className={`mj-brazo gm-brazo-${lado}`}>
      <path className="gm-piedra mj-contorno" d={BRAZO} />
      <path className="gm-runa" d="M36 100l8 6-6 8 8 6" />
      <rect className="gm-piedra-osc mj-contorno" x="6" y="128" width="46" height="36" rx="12" />
      <path className="mj-trazo" strokeWidth="2" d="M18 134v9M29 132v10M40 132v10" />
    </g>
  );
}

function Cuerpo() {
  return (
    <>
      <defs>
        <linearGradient id="gm-piedra" x1="0" y1="0" x2=".4" y2="1">
          <stop offset="0" stopColor="#A4A6B2" />
          <stop offset=".5" stopColor="#626574" />
          <stop offset="1" stopColor="#30323D" />
        </linearGradient>
      </defs>

      {/* ---------- Piernas ---------- */}
      <rect className="gm-piedra-osc mj-contorno" x="56" y="150" width="34" height="38" rx="7" />
      <rect className="gm-piedra-osc mj-contorno" x="110" y="150" width="34" height="38" rx="7" />

      {/* ---------- Brazos (el derecho, en espejo) ---------- */}
      <Brazo lado="izq" />
      <g transform="translate(200 0) scale(-1 1)"><Brazo lado="der" /></g>

      {/* ---------- Torso ---------- */}
      <path className="gm-piedra mj-contorno" d="M50 66h100l20 50-16 46H46l-16-46z" />
      <path className="mj-trazo gm-junta" strokeWidth="2" d="M58 98l20 8M142 98l-20 8M66 154l12-14M134 154l-12-14M100 72v14" />
      <circle className="gm-anillo" cx="100" cy="140" r="27" />
      <path className="gm-runa" d="M70 128h8M122 128h8M74 156l6-4M126 156l-6-4" />

      {/* ---------- Hombros: el derecho se parte en la etapa 3 ---------- */}
      <circle className="gm-piedra mj-contorno" cx="42" cy="80" r="20" />
      <path className="gm-musgo" d="M26 72c4-10 16-14 26-10-2 6-10 8-14 6-4 4-8 5-12 4z" />
      <circle className="gm-piedra mj-contorno gm-hombro-entero" cx="158" cy="80" r="20" />
      <path className="gm-piedra mj-contorno gm-hombro-roto" d="M158 60a20 20 0 0 0 0 40l5-8-6-7 7-8-6-9 5-8z" />

      {/* ---------- Cabeza ---------- */}
      <path className="gm-piedra mj-contorno" d="M70 18h60l8 20-6 30H68l-6-30z" />
      <path className="gm-musgo" d="M70 20c6-6 14-4 18 0 6-5 14-4 18 1 6-4 14-3 22 0l-2 5H72z" />
      <ellipse className="mj-cuenca" cx="86" cy="42" rx="12" ry="7" />
      <ellipse className="mj-cuenca" cx="114" cy="42" rx="12" ry="7" />

      <Nucleo />

      {/* ---------- Caras (ojos en (86, 42) y (114, 42)) ---------- */}
      <g className="mj-cara mj-cara-confiado">
        <path className="mj-ojo" d="M77 41l18-3-2 7-14 0zM123 41l-18-3 2 7 14 0z" />
        <path className="mj-trazo" strokeWidth="5" d="M72 32l26 6M128 32l-26 6" />
        <path className="mj-trazo" strokeWidth="3" d="M86 58q16 6 28-3" />
      </g>

      <g className="mj-cara mj-cara-molesto">
        <ellipse className="mj-ojo" cx="86" cy="43" rx="7" ry="5" />
        <ellipse className="mj-ojo" cx="114" cy="43" rx="7" ry="5" />
        <path className="mj-trazo" strokeWidth="6" d="M72 28l26 11M128 28l-26 11" />
        <rect className="gm-dientes" x="84" y="53" width="32" height="10" rx="2" />
        <path className="mj-trazo" strokeWidth="1.6" d="M84 58h32M92 53v10M100 53v10M108 53v10" />
      </g>

      <g className="mj-cara mj-cara-herido">
        <ellipse className="gm-ojo-apagado" cx="86" cy="43" rx="5" ry="2" />
        <ellipse className="mj-ojo" cx="114" cy="42" rx="7" ry="6" />
        <path className="mj-trazo" strokeWidth="5" d="M74 36l24-3M126 32l-22 5" />
        <path className="mj-boca" d="M86 56q8-4 14 0t14 2q-2 8-14 7-12 0-14-9z" />
      </g>

      <g className="mj-cara mj-cara-mareado">
        <path className="mj-espiral" d={espiral(86, 42)} />
        <path className="mj-espiral" d={espiral(114, 42)} />
        <path className="mj-trazo" strokeWidth="3" d="M86 58q4-4 7 0t7 0 7 0 7 0" />
      </g>

      <g className="mj-cara mj-cara-ko">
        <path className="mj-equis" d="M80 36l12 12M92 36l-12 12M108 36l12 12M120 36l-12 12" />
        <path className="mj-trazo" strokeWidth="3" d="M88 59h24" />
      </g>

      <g className="mj-cara mj-cara-risa">
        <path className="mj-ojo-linea" d="M77 45q9-10 18 0M105 45q9-10 18 0" />
        <path className="mj-boca" d="M82 52h36q-4 15-18 15t-18-15z" />
        <path className="mj-diente" d="M86 52l3 6 3-6zM108 52l3 6 3-6z" />
      </g>

      <g className="mj-cara mj-cara-dormido">
        <path className="gm-ojo-linea-apagado" d="M77 42q9 5 18 0M105 42q9 5 18 0" />
        <path className="mj-trazo" strokeWidth="3" d="M92 58h16" />
      </g>

      {/* ---------- Grietas encendidas ---------- */}
      <Grieta clase="mj-d2" puntos={['56,74 66,88 60,98 70,110']} />
      <Grieta clase="mj-d3" puntos={['112,20 106,30 112,36 108,46', '150,120 140,130 146,140']} />
      <Grieta clase="mj-d4" puntos={['30,100 40,108 36,120', '58,150 70,144 76,156', '124,60 130,50 138,52']} />
    </>
  );
}

/** El pedazo de hombro que cae (etapa 3) y las piedritas que se desprenden (etapa 4). */
function Fuera() {
  return (
    <>
      <path className="gm-piedra mj-contorno mj-punta gm-roca" d="M158 60a20 20 0 0 1 20 20c0 11-9 20-20 20l-6-6 6-6-8-6 6-8-6-8c2-4 5-6 8-6z" />
      <g className="gm-piedritas mj-d4">
        <path d="M60 158l6-3 4 4-4 5-6-1z" />
        <path d="M136 160l5-4 5 3-2 6-6 0z" />
        <path d="M96 166l4-3 4 3-3 4z" />
      </g>
    </>
  );
}

export const golem: DibujoMonstruo = {
  Cuerpo,
  Fuera,
  silueta: SILUETA,
  cabeza: [100, 40],
  humo: [[100, 22], [40, 120], [160, 120]],
  impactos: [[66, 100], [136, 96], [84, 150], [120, 132], [100, 44]],
};
