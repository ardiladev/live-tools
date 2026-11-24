// =============================================================================
// widgets/subathon/Bomba.tsx — Modo «Bomba de tiempo» del Subathon (subathon.html con md: 'bomba')
//
// Una bomba de dibujo (SVG propio) con la mecha encendida: lo que queda de mecha es el tiempo que
// falta (la mecha completa = el tope `cap`), con la chispa en la punta. Encima, la cuenta atrás.
// Cada regalo la acelera (chispazo y «−0:12» naranja) y los likes la enfrían («+0:03» celeste).
// Con menos de 10 s tiembla y se pone roja. En 0 explota: destello, rayos, humo, «¡BOOM!» y el
// reto que le toca a la bailarina. Reglas en motor.ts (las mismas del subathon); estilos en bomba.css.
// =============================================================================

import { useLayoutEffect, useRef } from 'react';
import { useReiniciarAnimacion } from '../../hooks/useReiniciarAnimacion';
import { formatoReloj } from '../../nucleo/reloj';
import type { FaseSubathon } from './config';
import { retoDe, type EstadoSubathon } from './motor';
import './bomba.css';

export const URGENTE_BOMBA_MS = 10000;

const ESTADOS: Record<FaseSubathon, string> = {
  listo: 'Lista para encender',
  corre: 'Los regalos la aceleran · los likes la enfrían',
  pausa: 'Mecha en pausa',
  fin: '',
};

// Rayos y bocanadas de humo de la explosión: [ángulo en grados] y [dx, dy, tamaño] (fijos).
const RAYOS = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
const HUMO = [[-34, -18, 1], [30, -24, 1.2], [-10, 26, 0.9], [38, 20, 1.1], [-42, 14, 0.8], [6, -38, 1]] as const;

export function Bomba({ estado, fase, queda, alQuitarFlotante }: {
  estado: EstadoSubathon;
  fase: FaseSubathon;
  /** ms que quedan (0 = explotó). */
  queda: number;
  alQuitarFlotante: () => void;
}) {
  const mecha = useRef<SVGPathElement>(null);
  const chispa = useRef<SVGGElement>(null);
  const escena = useRef<HTMLDivElement>(null);
  useReiniciarAnimacion(escena, 'chispazo', estado.chispas);

  // La mecha que queda (desde la tapa) y la chispa en su punta.
  const fraccion = Math.min(1, Math.max(0, queda / Math.max(1, estado.capMs)));
  useLayoutEffect(() => {
    const camino = mecha.current;
    const punta = chispa.current;
    if (!camino || !punta) return;
    const largo = camino.getTotalLength();
    camino.style.strokeDasharray = `${largo * fraccion} ${largo}`;
    const p = camino.getPointAtLength(largo * fraccion);
    punta.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
  }, [fraccion]);

  const exploto = fase === 'fin';
  const urgente = fase === 'corre' && queda < URGENTE_BOMBA_MS;
  const reto = retoDe(estado);
  const clases = ['bomba-escena', urgente && 'urgente', estado.chispas > 0 && 'chispazo'].filter(Boolean).join(' ');

  return (
    <main className={clases} data-fase={fase} ref={escena}>
      {estado.titulo ? <div className="bomba-titulo">{estado.titulo}</div> : null}

      <div className="bomba-caja">
        <svg className="bomba-dibujo" viewBox="0 0 300 300" aria-hidden="true">
          <defs>
            <radialGradient id="bo-cuerpo" cx="36%" cy="32%" r="75%">
              <stop offset="0" stopColor="#5A5A66" />
              <stop offset=".45" stopColor="#1C1C22" />
              <stop offset="1" stopColor="#050507" />
            </radialGradient>
            <linearGradient id="bo-tapa" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#FFF1B8" />
              <stop offset=".5" stopColor="#D4AF37" />
              <stop offset="1" stopColor="#8A6A16" />
            </linearGradient>
            <radialGradient id="bo-chispa">
              <stop offset="0" stopColor="#FFFFFF" />
              <stop offset=".35" stopColor="#FFE066" />
              <stop offset="1" stopColor="#FF7A00" stopOpacity="0" />
            </radialGradient>
          </defs>

          <g className="bo-bomba">
            <ellipse className="bo-sombra" cx="146" cy="276" rx="84" ry="10" />
            {/* Mecha (la que queda) y su rastro quemado */}
            <path className="bo-mecha-quemada" d="M214 86C236 58 268 70 262 42S238 6 276 6" />
            <path className="bo-mecha" ref={mecha} d="M214 86C236 58 268 70 262 42S238 6 276 6" />
            <g transform="translate(206 98) rotate(42)">
              <rect className="bo-tapa" x="-26" y="-18" width="52" height="34" rx="7" />
              <rect className="bo-tapa-brillo" x="-20" y="-13" width="40" height="6" rx="3" />
            </g>
            <circle className="bo-cuerpo" cx="140" cy="172" r="94" />
            <ellipse className="bo-reflejo" cx="98" cy="124" rx="28" ry="15" transform="rotate(-35 98 124)" />
            <circle className="bo-reflejo" cx="74" cy="160" r="5" />
            {/* La chispa en la punta de la mecha */}
            <g ref={chispa} className="bo-chispa">
              <circle r="18" fill="url(#bo-chispa)" />
              <path className="bo-destellos" d="M0-22V-8M0 8V22M-22 0H-8M8 0H22M-15-15l7 7M8 8l7 7M15-15l-7 7M-8 8l-7 7" />
            </g>
          </g>

          {/* Explosión */}
          <g className="bo-explosion">
            <circle className="bo-destello" cx="140" cy="168" r="120" />
            {RAYOS.map((a) => (
              <path key={a} className="bo-rayo" d="M140 168l10-150-20 0z" transform={`rotate(${a} 140 168)`} style={{ animationDelay: `${(a % 60) * 4}ms` }} />
            ))}
            {HUMO.map(([dx, dy, t], i) => (
              <circle key={i} className="bo-humo" cx={140 + dx * 1.6} cy={168 + dy * 1.6} r={34 * t} style={{ animationDelay: `${120 + i * 70}ms` }} />
            ))}
          </g>
        </svg>

        {/* La cuenta atrás, sobre el cuerpo de la bomba */}
        <div className="bomba-tiempo" role="timer">{exploto ? '' : formatoReloj(queda)}</div>
        <div className="bomba-boom" aria-live="polite">{exploto ? '¡BOOM!' : ''}</div>

        <div className="sumas" aria-hidden="true">
          {estado.flotante ? (
            <span key={estado.flotante.clave} className={estado.flotante.resta ? 'suma resta' : 'suma enfria'} onAnimationEnd={alQuitarFlotante}>
              {estado.flotante.texto}
            </span>
          ) : null}
        </div>
      </div>

      {exploto ? (
        <div className="bomba-reto cristal" role="status">
          <span className="etiqueta-reto">{reto ? 'Reto para la bailarina' : '¡Explotó!'}</span>
          {reto ? <span className="texto-reto">{reto}</span> : null}
        </div>
      ) : (
        <div className="bomba-estado">{ESTADOS[fase]}</div>
      )}
    </main>
  );
}
