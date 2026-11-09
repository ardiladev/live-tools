// =============================================================================
// widgets/jefe/Monstruo.tsx — El monstruo del "Jefe del LIVE" (SVG, diseño propio)
//
// Hay cinco monstruos para elegir en el panel (monstruos/catalogo.ts), del menos al más
// amenazante: Gelatón, Bestia de obsidiana (el de siempre), Gólem de piedra, Dragón de brasas y
// Rey del abismo. Todos se van rompiendo a medida que baja la barra de vida, en las mismas
// cuatro etapas, y tienen las mismas caras:
//   etapa 1 (100–75 %) confiado · etapa 2 (75–50 %) molesto · etapa 3 (50–25 %) herido ·
//   etapa 4 (25–0 %) mareado · vencido = K.O. (el núcleo estalla en monedas y le giran estrellas)
// Además: en pausa se duerme (zzz) y si se acaba el tiempo se burla.
// Cada golpe lo hace retroceder con un destello y una chispa (más fuerte con regalos).
//
// Este archivo es el MARCO común: capas de movimiento, destello, chispa, humo, zetas, monedas y
// estrellas. El dibujo de cada monstruo está en monstruos/<Nombre>.tsx (ver monstruos/comun.tsx).
// Todo el dibujo es SVG sin texto (no cambia el texto del widget). Qué se ve en cada momento
// lo decide el CSS (monstruo.css y monstruos.css) con data-tipo, data-etapa, data-cara y
// data-fase; las animaciones de golpe se reinician con la clase `golpe` (useReiniciarAnimacion).
// El oro sale de las variables del estilo del widget (--activo, --borde-color).
// =============================================================================

import { useRef, type CSSProperties } from 'react';
import { useReiniciarAnimacion } from '../../hooks/useReiniciarAnimacion';
import type { FaseJefe } from './config';
import { bestia } from './monstruos/Bestia';
import { dragon } from './monstruos/Dragon';
import { gelaton } from './monstruos/Gelaton';
import { golem } from './monstruos/Golem';
import { rey } from './monstruos/Rey';
import type { TipoMonstruo } from './monstruos/catalogo';
import type { DibujoMonstruo } from './monstruos/comun';
import './monstruo.css';
import './monstruos.css';

export type EtapaMonstruo = 1 | 2 | 3 | 4;
type Cara = 'confiado' | 'molesto' | 'herido' | 'mareado' | 'ko' | 'risa' | 'dormido';

const DIBUJOS: Record<TipoMonstruo, DibujoMonstruo> = { gelaton, bestia, golem, dragon, rey };

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
// Cuatro estrellas en círculo alrededor de la cabeza (dibujadas para una cabeza en (96, 40); el
// CSS las hace girar en óvalo). Las zetas, igual: salen junto a esa cabeza.
const CABEZA_BASE = [96, 40] as const;
const ESTRELLAS = [[132, 40], [96, 76], [60, 40], [96, 4]].map(([x, y]) => estrella(x ?? 0, y ?? 0, 10));

export function Monstruo({ tipo = 'bestia', etapa, fase, golpes, fuerte }: {
  /** Cuál de los cinco monstruos (monstruos/catalogo.ts). */
  tipo?: TipoMonstruo;
  etapa: EtapaMonstruo;
  fase: FaseJefe;
  /** Cuántos golpes lleva (cada uno reinicia la animación de golpe). */
  golpes: number;
  /** El último golpe fue un regalo (retroceso y chispa más grandes). */
  fuerte: boolean;
}) {
  const raiz = useRef<HTMLDivElement>(null);
  useReiniciarAnimacion(raiz, 'golpe', golpes);
  const dibujo = DIBUJOS[tipo] ?? bestia;
  const { Cuerpo, Fuera } = dibujo;
  const [ix, iy] = dibujo.impactos[golpes % dibujo.impactos.length] ?? [100, 100];
  const cabeza = `translate(${dibujo.cabeza[0] - CABEZA_BASE[0]} ${dibujo.cabeza[1] - CABEZA_BASE[1]})`;
  const clases = ['monstruo', golpes > 0 && 'golpe', fuerte && 'fuerte'].filter(Boolean).join(' ');

  return (
    <div className={clases} ref={raiz} data-tipo={tipo} data-etapa={fase === 'vencido' ? 4 : etapa} data-fase={fase} data-cara={caraDe(etapa, fase)} aria-hidden="true">
      <svg viewBox="-14 -24 228 228" preserveAspectRatio="xMidYMax meet">
        <defs>
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

        {/* Capas de movimiento: golpe y derrota > temblor y burla > respiración > forma (etapas) */}
        <g className="mj-figura">
          <g className="mj-tiembla">
            <g className="mj-respira">
              <g className="mj-forma">
                <Cuerpo />
                {/* Destello del golpe (la silueta en blanco) */}
                <path className="mj-destello" d={dibujo.silueta} />
              </g>
            </g>
          </g>
        </g>

        {/* ---------- Efectos (fuera del cuerpo) ---------- */}
        {Fuera && <Fuera />}

        {/* Humo (etapa 4) */}
        <g className="mj-humo mj-d4">
          {dibujo.humo.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i ? 6 : 7} />)}
        </g>

        {/* Chispa del golpe: se turna entre varios puntos del cuerpo */}
        <g transform={`translate(${ix} ${iy})`}>
          <path className="mj-impacto" d="M0-22l5 13 14-6-8 12 14 4-14 4 8 12-14-6-5 13-5-13-14 6 8-12-14-4 14-4-8-12 14 6z" />
        </g>

        {/* Zzz (pausa) */}
        <g transform={cabeza}>
          <path className="mj-zeta mj-zeta-1" d="M150 40h10l-10 12h10" />
          <path className="mj-zeta mj-zeta-2" d="M164 22h13l-13 15h13" />
          <path className="mj-zeta mj-zeta-3" d="M181 0h16l-16 18h16" />
        </g>

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
        <g transform={cabeza}>
          <g className="mj-estrellas">
            {ESTRELLAS.map((d, i) => <path key={i} d={d} />)}
          </g>
        </g>
      </svg>
    </div>
  );
}
