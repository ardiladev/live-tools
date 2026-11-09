// =============================================================================
// widgets/jefe/monstruos/Gelaton.tsx — Gelatón (amenaza 1: travieso)
//
// Una gelatina con un rulito arriba y una gema tragada en la panza. Rebota al respirar.
//   etapa 1 confiado: ojos grandes con brillo, cachetes y la lengua afuera
//   etapa 2 molesto: ceño fruncido, una curita y gotas que salpican
//   etapa 3 herido: se aplasta, deja un charco y le cae una lágrima
//   etapa 4 mareado: más derretido, burbujas que suben rápido, humo
// Estilos en la sección 2 de monstruos.css.
// =============================================================================

import { Curita, espiral, gota, Nucleo, type DibujoMonstruo } from './comun';

const SILUETA = 'M100 66c44 0 74 40 80 92 3 22-12 32-80 32s-83-10-80-32c6-52 36-92 80-92z';

function Cuerpo() {
  return (
    <>
      <defs>
        <radialGradient id="gl-gel" cx="38%" cy="30%" r="80%">
          <stop offset="0" stopColor="#C8FFEC" />
          <stop offset=".45" stopColor="#46D6AC" />
          <stop offset="1" stopColor="#11766A" />
        </radialGradient>
      </defs>

      {/* Charco (etapa 3+): crece en la 4 */}
      <ellipse className="gl-charco mj-d3" cx="100" cy="188" rx="86" ry="8" />

      {/* Cuerpo y rulito */}
      <path className="gl-cuerpo" d="M97 69c-7-10-3-23 10-27-4 8-2 17 3 26z" />
      <path className="gl-cuerpo" d={SILUETA} />
      <ellipse className="gl-reflejo" cx="60" cy="106" rx="9" ry="20" transform="rotate(28 60 106)" />
      <circle className="gl-reflejo" cx="52" cy="138" r="4" />

      {/* La gema tragada, con un velo de gelatina encima */}
      <Nucleo />
      <ellipse className="gl-velo" cx="100" cy="146" rx="40" ry="26" />

      {/* Burbujas por dentro */}
      <g className="gl-burbujas">
        <circle cx="140" cy="166" r="5" />
        <circle cx="68" cy="176" r="3.5" />
        <circle cx="150" cy="126" r="3" />
        <circle cx="54" cy="160" r="2.5" />
      </g>

      {/* ---------- Caras (ojos en (82, 96) y (118, 96)) ---------- */}
      <g className="mj-cara mj-cara-confiado">
        <ellipse className="gl-ojo" cx="82" cy="96" rx="7" ry="9" />
        <ellipse className="gl-ojo" cx="118" cy="96" rx="7" ry="9" />
        <circle className="gl-chispa" cx="84.5" cy="92.5" r="2.4" />
        <circle className="gl-chispa" cx="120.5" cy="92.5" r="2.4" />
        <ellipse className="gl-rubor" cx="68" cy="108" rx="6" ry="3" />
        <ellipse className="gl-rubor" cx="132" cy="108" rx="6" ry="3" />
        <path className="mj-boca" d="M88 107q12 11 24 0-12 4-24 0z" />
        <path className="mj-lengua" d="M103 110q4 9 10 1z" />
      </g>

      <g className="mj-cara mj-cara-molesto">
        <ellipse className="gl-ojo" cx="82" cy="97" rx="7" ry="8" />
        <ellipse className="gl-ojo" cx="118" cy="97" rx="7" ry="8" />
        <circle className="gl-chispa" cx="84" cy="94" r="2" />
        <circle className="gl-chispa" cx="120" cy="94" r="2" />
        <path className="mj-trazo" strokeWidth="4" d="M71 84l16 6M129 84l-16 6" />
        <path className="mj-trazo" strokeWidth="3.5" d="M90 114q10-8 20 0" />
      </g>

      <g className="mj-cara mj-cara-herido">
        <path className="mj-trazo" strokeWidth="3.5" d="M75 97q7 4 14 0" />
        <ellipse className="gl-ojo" cx="118" cy="96" rx="7" ry="9" />
        <circle className="gl-chispa" cx="120.5" cy="92.5" r="2.4" />
        <path className="mj-trazo" strokeWidth="3" d="M72 86l14-3M128 86l-14-3" />
        <path className="mj-trazo" strokeWidth="3" d="M88 113q4-4 8 0t8 0 8 0" />
        <path className="mj-sudor" d={gota(127, 104, 4)} />
      </g>

      <g className="mj-cara mj-cara-mareado">
        <path className="mj-espiral" d={espiral(82, 96)} />
        <path className="mj-espiral" d={espiral(118, 96)} />
        <ellipse className="mj-boca" cx="100" cy="113" rx="6" ry="5" />
      </g>

      <g className="mj-cara mj-cara-dolor">
        <path className="mj-trazo" strokeWidth="4" d="M75 90l12 6-12 6M125 90l-12 6 12 6" />
        <path className="mj-boca" d="M88 105h24q-2 13-12 13t-12-13z" />
        <path className="mj-sudor" d={gota(134, 86, 4)} />
      </g>

      <g className="mj-cara mj-cara-ko">
        <path className="mj-equis" d="M76 90l12 12M88 90l-12 12M112 90l12 12M124 90l-12 12" />
        <path className="mj-trazo" strokeWidth="3" d="M88 110q6-4 12 0t12 0" />
        <path className="mj-lengua" d="M102 111q2 10 8 9 5-2 1-10z" />
      </g>

      <g className="mj-cara mj-cara-risa">
        <path className="mj-trazo" strokeWidth="4" d="M74 98q8-10 16 0M110 98q8-10 16 0" />
        <ellipse className="gl-rubor" cx="68" cy="106" rx="6" ry="3" />
        <ellipse className="gl-rubor" cx="132" cy="106" rx="6" ry="3" />
        <path className="mj-boca" d="M86 105h28q-2 15-14 15t-14-15z" />
        <ellipse className="mj-lengua" cx="100" cy="116" rx="7" ry="3" />
      </g>

      <g className="mj-cara mj-cara-dormido">
        <path className="mj-trazo" strokeWidth="3.5" d="M74 96q8 6 16 0M110 96q8 6 16 0" />
        <ellipse className="mj-boca" cx="100" cy="110" rx="4" ry="3" />
        <circle className="mj-burbuja" cx="109" cy="113" r="5" />
      </g>

      {/* ---------- Daño ---------- */}
      <Curita x={130} y={80} clase="mj-d2" />
      <g className="mj-d2">
        <path className="gl-gota gl-gota-1" d={gota(30, 140, 5)} />
        <path className="gl-gota gl-gota-2" d={gota(170, 132, 5)} />
      </g>
      <path className="mj-sudor mj-d3" d={gota(150, 92, 5)} />
    </>
  );
}

export const gelaton: DibujoMonstruo = {
  Cuerpo,
  silueta: SILUETA,
  cabeza: [100, 88],
  humo: [[104, 62], [46, 132], [156, 132]],
  impactos: [[66, 120], [134, 116], [88, 160], [122, 150], [100, 86]],
};
