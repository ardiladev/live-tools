// =============================================================================
// widgets/meta/Confeti.tsx — Pequeña explosión de confeti al alcanzar la meta
//
// Se activa con la casilla «Confeti al alcanzar la meta» (clave `cf` de la config). Nace en el
// centro, justo sobre la barra: las piezas salen disparadas hacia arriba y a los lados, y luego
// caen girando hasta desvanecerse (keyframes en meta.css). Las piezas salen de piezasConfeti:
// misma semilla = mismas piezas, así cada celebración es distinta pero repetible en las pruebas.
// Colores ya calculados o variables simples (sin color-mix(): OBS viejo lo pinta negro).
// =============================================================================

import { useEffect, type CSSProperties } from 'react';

/** Cuánto dura la explosión completa (la pieza más lenta termina antes de esto). */
export const DURACION_CONFETI_MS = 2800;

// El color de la meta (o el acento del estilo), oro claro y blanco.
const TONOS = ['var(--color)', 'var(--color)', '#F3DFA2', '#FFFFFF'] as const;

export interface PiezaConfeti {
  /** Desplazamiento horizontal final (vw) y altura máxima del salto (vh, negativa = arriba). */
  dx: number;
  alto: number;
  /** Hasta dónde cae al final (vh, desde el origen). */
  caida: number;
  giro: number;
  ancho: number;
  /** Proporción alto/ancho: tiritas (0,4) o cuadritos (1). */
  forma: number;
  retraso: number;
  duracion: number;
  tono: number;
}

/** Piezas de una explosión. Determinista: la misma `semilla` da siempre las mismas piezas. */
export function piezasConfeti(semilla: number, cantidad = 44): PiezaConfeti[] {
  let a = (semilla * 2654435761) >>> 0;
  const azar = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return Array.from({ length: cantidad }, () => {
    // Abanico hacia arriba: más piezas cerca del centro, algunas bien abiertas a los lados.
    const lado = azar() * 2 - 1;
    return {
      dx: Math.round(lado * Math.abs(lado) * 34 + lado * 6),
      alto: -Math.round(12 + azar() * 22),
      caida: Math.round(30 + azar() * 40),
      giro: Math.round(azar() * 900 - 450),
      ancho: 0.9 + azar() * 0.9,
      forma: azar() < 0.65 ? 0.4 : 1,
      retraso: Math.round(azar() * 120) / 1000,
      duracion: 1.7 + Math.round(azar() * 900) / 1000,
      tono: Math.floor(azar() * TONOS.length),
    };
  });
}

/** Una explosión. Se monta con `key` = número de celebración y avisa al terminar. */
export function Confeti({ semilla, alTerminar }: { semilla: number; alTerminar: () => void }) {
  useEffect(() => {
    const t = setTimeout(alTerminar, DURACION_CONFETI_MS);
    return () => clearTimeout(t);
  }, [semilla]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="confeti-meta" aria-hidden="true">
      {piezasConfeti(semilla).map((p, i) => (
        <span
          key={i}
          className="pieza-confeti"
          style={{
            width: `${p.ancho}vw`,
            height: `${p.ancho * p.forma}vw`,
            background: TONOS[p.tono],
            animationDelay: `${p.retraso}s`,
            animationDuration: `${p.duracion}s`,
            '--dx': `${p.dx}vw`,
            '--alto': `${p.alto}vh`,
            '--caida': `${p.caida}vh`,
            '--giro': `${p.giro}deg`,
          } as CSSProperties}
        />
      ))}
    </div>
  );
}
