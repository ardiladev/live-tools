// =============================================================================
// widgets/jefe/monstruos/comun.tsx — Piezas que comparten todos los monstruos
//
// Cada monstruo (Bestia.tsx, Gelaton.tsx…) es un DibujoMonstruo: el cuerpo con sus caras y su
// daño, lo que se mueve aparte (puntas que caen…) y unos pocos puntos de referencia para los
// efectos comunes que dibuja Monstruo.tsx (humo, chispas, zetas, estrellas).
// Reglas comunes a todos los dibujos (las usa monstruo.css):
//   - Coordenadas: el cuerpo centrado en x = 100, el suelo en y ≈ 190.
//   - El NÚCLEO dorado va siempre en (100, 140): de ahí salen las monedas al vencerlo.
//   - Daño acumulado con las clases mj-d2, mj-d3, mj-d4; caras con mj-cara mj-cara-<cara>.
// =============================================================================

import type { ReactNode } from 'react';

export type Punto = readonly [number, number];

export interface DibujoMonstruo {
  /** Defs propias (degradados) + todo lo que se mueve con el cuerpo (golpe, respiración). */
  Cuerpo: () => ReactNode;
  /** Lo que va fuera del cuerpo y se anima por su cuenta (puntas que caen, corona…). */
  Fuera?: () => ReactNode;
  /** Silueta del cuerpo: destella en blanco con cada golpe. */
  silueta: string;
  /** Centro de la cabeza: ahí giran las estrellas al vencerlo y de ahí salen las zetas. */
  cabeza: Punto;
  /** De dónde sale el humo en la etapa 4. */
  humo: readonly Punto[];
  /** Dónde salta la chispa de cada golpe (se turnan). */
  impactos: readonly Punto[];
}

/** El núcleo dorado del pecho, en (100, 140): late, se raja con el daño y estalla al vencerlo. */
export function Nucleo() {
  return (
    <g className="mj-nucleo">
      <circle className="mj-halo" cx="100" cy="140" r="30" />
      <path className="mj-gema" d="M100 121l17 19-17 19-17-19z" />
      <path className="mj-faceta" d="M100 121v38M83 140h34M91 130l18 20M109 130l-18 20" />
      <path className="mj-raja mj-d2" d="M100 125l-4 10 5 6" />
      <path className="mj-raja mj-d3" d="M111 135l-6 10 4 6" />
      <path className="mj-raja mj-d4" d="M88 138l7 6-4 7" />
    </g>
  );
}

/** Grieta con brillo por dentro (se dibuja al aparecer). `clase` = mj-d2, mj-d3 o mj-d4. */
export function Grieta({ clase, puntos }: { clase: string; puntos: string[] }) {
  return (
    <g className={clase}>
      {puntos.map((p, i) => <polyline key={`f${i}`} className="mj-grieta-fondo" pathLength={100} points={p} />)}
      {puntos.map((p, i) => <polyline key={`g${i}`} className="mj-grieta" pathLength={100} points={p} />)}
    </g>
  );
}

/** Curita en cruz centrada en (x, y). */
export function Curita({ x, y, clase = 'mj-d3' }: { x: number; y: number; clase?: string }) {
  return (
    <g className={clase} transform={`translate(${x} ${y})`}>
      <rect className="mj-curita" x="-14" y="-4.5" width="28" height="9" rx="4.5" transform="rotate(35)" />
      <rect className="mj-curita" x="-14" y="-4.5" width="28" height="9" rx="4.5" transform="rotate(-35)" />
      <rect className="mj-curita-centro" x="-4" y="-4" width="8" height="8" rx="2" />
    </g>
  );
}

/** Espiral de mareo centrada en (x, y). */
export const espiral = (x: number, y: number): string =>
  `M${x} ${y}m-1 0a1 1 0 1 1 2 0 3 3 0 1 1-5-1 5 5 0 1 1 9 3 7 7 0 1 1-13-4`;

/** Gota (sudor, lágrima) con la punta en (x, y). */
export const gota = (x: number, y: number, t = 7): string =>
  `M${x} ${y}c0 0-${t} ${t * 1.3} -${t} ${t * 1.85}a${t} ${t} 0 0 0 ${t * 2} 0c0-${t * 0.55}-${t}-${t * 1.85}-${t}-${t * 1.85}z`;
