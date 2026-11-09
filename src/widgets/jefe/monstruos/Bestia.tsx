// =============================================================================
// widgets/jefe/monstruos/Bestia.tsx — Bestia de obsidiana (amenaza 2; el monstruo de siempre)
//
// Una bestia de obsidiana con cuernos de oro y el núcleo dorado en el pecho:
//   etapa 1 (100–75 %) confiado: sonrisa con colmillos, ojos entrecerrados
//   etapa 2 (75–50 %)  molesto: dientes apretados, primera grieta, el núcleo se raja
//   etapa 3 (50–25 %)  herido: se le rompe un cuerno (la punta cae), ojo morado, curita, sudor
//   etapa 4 (25–0 %)   mareado: ojos en espiral, el otro cuerno roto, humo, el núcleo parpadea
//   vencido            K.O.: ojos en X y la lengua afuera
// Estilos propios en la sección 8 de monstruo.css.
// =============================================================================

import { Curita, Grieta, Nucleo, type DibujoMonstruo } from './comun';

const BRAZO = 'M42 104C24 108 10 126 12 144c1 10 10 14 18 8 6-6 10-18 16-28z';
const GARRA = 'M12 146l-8 4 9 1zM15 152l-6 6 9-3zM21 156l-3 7 7-6z';
const SILUETA = 'M100 40c42 0 70 32 71 74s-25 72-71 72-70-30-71-72S58 40 100 40z';

function Cuerpo() {
  return (
    <>
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
      </defs>

      {/* ---------- Brazos (detrás del cuerpo) ---------- */}
      <g className="mj-brazo mj-brazo-izq">
        <path className="mj-piel mj-contorno" d={BRAZO} />
        <path className="mj-garra" d={GARRA} />
      </g>
      <g transform="translate(200 0) scale(-1 1)">
        <g className="mj-brazo mj-brazo-der">
          <path className="mj-piel mj-contorno" d={BRAZO} />
          <path className="mj-garra" d={GARRA} />
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
      <path className="mj-piel mj-contorno" d={SILUETA} />
      <path className="mj-borde-luz" d="M140 52c20 14 30 38 30 62" />
      <ellipse className="mj-brillo" cx="70" cy="70" rx="17" ry="10" transform="rotate(-32 70 70)" />
      <ellipse className="mj-panza" cx="100" cy="142" rx="44" ry="38" />
      <path className="mj-escamas" d="M68 128q32-9 64 0M64 144q36-9 72 0M68 160q32-8 64 0" />

      <Nucleo />

      {/* ---------- Grietas con lava (se dibujan al aparecer) ---------- */}
      <Grieta clase="mj-d2" puntos={['46,96 57,103 53,112 63,120 59,129']} />
      <Grieta clase="mj-d3" puntos={['154,96 145,109 155,119 147,132']} />
      <Grieta clase="mj-d4" puntos={['106,42 99,55 107,62 101,70', '84,168 95,174 90,181']} />

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
      <Curita x={76} y={54} />
      <path className="mj-sudor mj-d3" d="M146 64c0 0-7 9-7 13a7 7 0 0 0 14 0c0-4-7-13-7-13z" />
    </>
  );
}

/** Puntas de los cuernos que caen al romperse. */
function Fuera() {
  return (
    <>
      <path className="mj-cuerno mj-contorno mj-punta mj-punta-der" d="M146 42l-5-2-3-6-4 5-6-2c4-11 10-21 16-31 8 16 8 28 2 36z" />
      <path className="mj-cuerno mj-contorno mj-punta mj-punta-izq" d="M54 42l5-2 3-6 4 5 6-2C68 26 62 16 56 6c-8 16-8 28-2 36z" />
    </>
  );
}

export const bestia: DibujoMonstruo = {
  Cuerpo,
  Fuera,
  silueta: SILUETA,
  cabeza: [96, 40],
  humo: [[104, 44], [58, 100], [150, 104]],
  impactos: [[70, 104], [132, 98], [88, 152], [120, 140], [100, 72]],
};
