// =============================================================================
// widgets/boveda/Mapa.tsx — Modo «Mapa de aventura» de la Bóveda (boveda.html con md: 'mapa')
//
// Un camino que serpentea de izquierda a derecha: la salida, las casillas (🎁 premio · 🔥 reto ·
// ⚠️ trampa) y, al final, el cofre del tesoro. La ficha del público (una moneda de oro) avanza una
// casilla cada `pc` monedas en regalos; el tramo recorrido se pinta de oro. Al caer en una
// casilla aparece su cartel unos segundos; al llegar al tesoro, el cofre se abre con el texto
// secreto. Reglas en motor.ts (las de la bóveda); estilos en mapa.css.
// =============================================================================

import type { CSSProperties } from 'react';
import { useCifraAnimada } from '../../hooks/useCifraAnimada';
import type { TipoCasilla } from './config';
import { casillaDe, type EstadoBoveda } from './motor';
import './mapa.css';

const formato = new Intl.NumberFormat('es-CO');
const ICONOS: Record<TipoCasilla, string> = { p: '🎁', r: '🔥', t: '⚠️' };
const NOMBRES: Record<TipoCasilla, string> = { p: 'Premio', r: 'Reto', t: 'Trampa' };

/** Dónde va cada parada (salida, casillas, tesoro), en % del mapa. */
export function paradas(total: number): [number, number][] {
  return Array.from({ length: total }, (_, i) => {
    const x = 5 + (90 * i) / Math.max(1, total - 1);
    const y = 52 + 24 * Math.sin(i * 1.1);
    return [x, y];
  });
}

/** Un camino suave (Catmull-Rom → Bézier) por los puntos dados. */
export function camino(puntos: readonly [number, number][]): string {
  if (!puntos.length) return '';
  const p = (i: number): [number, number] => puntos[Math.max(0, Math.min(puntos.length - 1, i))] as [number, number];
  let d = `M${p(0)[0]} ${p(0)[1]}`;
  for (let i = 0; i < puntos.length - 1; i++) {
    const [x0, y0] = p(i - 1);
    const [x1, y1] = p(i);
    const [x2, y2] = p(i + 1);
    const [x3, y3] = p(i + 2);
    d += ` C${(x1 + (x2 - x0) / 6).toFixed(2)} ${(y1 + (y2 - y0) / 6).toFixed(2)} ${(x2 - (x3 - x1) / 6).toFixed(2)} ${(y2 - (y3 - y1) / 6).toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  }
  return d;
}

export function Mapa({ estado, alQuitarLlegada }: { estado: EstadoBoveda; alQuitarLlegada: (clave: number) => void }) {
  const n = estado.casillas.length;
  const puntos = paradas(n + 2);
  const va = casillaDe(estado);
  const monedas = useCifraAnimada(estado.monedas, { ms: 600, animar: estado.animarCifras });
  const [fx, fy] = puntos[va] ?? [5, 52];
  const faltan = estado.porCasilla - (estado.monedas % estado.porCasilla);
  const llegada = estado.llegada ? estado.casillas[estado.llegada.casilla - 1] : undefined;

  return (
    <main className="mapa-escena" data-estado={estado.abierta ? 'abierta' : 'cerrada'}>
      <header className="mapa-cabecera">
        <span className="mapa-titulo">{estado.titulo}</span>
        <span className="mapa-progreso">
          {estado.abierta ? '¡Llegaron al tesoro!'
            : va === 0 ? `Salida · ${formato.format(faltan)} monedas para avanzar`
              : `Casilla ${va} de ${n} · faltan ${formato.format(faltan)} monedas`}
        </span>
        <span className="mapa-monedas">{`${formato.format(monedas)} monedas`}</span>
      </header>

      <div className="mapa-tablero">
        <svg className="mapa-caminos" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path className="mapa-camino" d={camino(puntos)} />
          <path className="mapa-recorrido" d={camino(puntos.slice(0, va + 1))} />
        </svg>

        {puntos.map(([x, y], i) => {
          const casilla = i >= 1 && i <= n ? estado.casillas[i - 1] : undefined;
          const tipo = i === 0 ? 'salida' : i === n + 1 ? 'tesoro' : casilla?.tipo ?? 'p';
          const clases = ['parada', `tipo-${tipo}`, i < va && 'pasada', i === va && 'actual'].filter(Boolean).join(' ');
          return (
            <div key={i} className={clases} style={{ left: `${x}%`, top: `${y}%` } as CSSProperties}>
              <span className="icono-parada" aria-hidden="true">
                {i === 0 ? '🚩' : i === n + 1 ? (estado.abierta ? '👑' : '🧰') : ICONOS[casilla?.tipo ?? 'p']}
              </span>
              <span className="numero-parada">{i === 0 ? 'Salida' : i === n + 1 ? 'Tesoro' : i}</span>
              {casilla ? <span className="texto-parada">{casilla.texto}</span> : null}
            </div>
          );
        })}

        <div className="ficha-mapa" style={{ left: `${fx}%`, top: `${fy}%` } as CSSProperties} aria-hidden="true">★</div>
      </div>

      {estado.abierta ? (
        <div className="cartel-mapa tesoro cristal" role="status" aria-live="polite">
          <span className="etiqueta-cartel">¡Tesoro!</span>
          <span className="texto-cartel">{estado.secreto || '¡Desbloqueado!'}</span>
        </div>
      ) : llegada && estado.llegada ? (
        <div
          key={estado.llegada.clave}
          className={`cartel-mapa cristal tipo-${llegada.tipo}`}
          role="status"
          aria-live="polite"
          onAnimationEnd={(ev) => { if (ev.animationName === 'cartel-mapa') alQuitarLlegada(estado.llegada?.clave ?? 0); }}
        >
          <span className="etiqueta-cartel">{`${ICONOS[llegada.tipo]} Casilla ${estado.llegada.casilla} · ${NOMBRES[llegada.tipo]}`}</span>
          <span className="texto-cartel">{llegada.texto}</span>
        </div>
      ) : (
        <div className="pista-mapa">{estado.pista}</div>
      )}
    </main>
  );
}
