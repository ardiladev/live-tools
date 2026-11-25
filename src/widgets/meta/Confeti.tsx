// =============================================================================
// widgets/meta/Confeti.tsx — Chorro continuo de confeti al alcanzar la meta
//
// Se activa con la casilla «Confeti al alcanzar la meta» (clave `cf` de la config). Nace en el
// centro, justo sobre la barra: arranca con una explosión y, mientras `emitiendo` sea true, sigue
// saliendo confeti en oleadas cortas (una cada OLA_MS). Cada pieza sube en abanico y luego cae
// girando hasta desvanecerse (keyframes en meta.css). Cuando deja de emitir, las piezas que ya
// están en el aire terminan su caída y entonces avisa (alTerminar).
// Las piezas salen de piezasConfeti: misma semilla = mismas piezas (repetible en las pruebas).
// Colores ya calculados o variables simples (sin color-mix(): OBS viejo lo pinta negro).
// =============================================================================

import { useEffect, useRef, useState, type CSSProperties } from 'react';

/** Cada cuánto sale una oleada nueva y cuántas piezas trae (la primera es la explosión). */
export const OLA_MS = 110;
export const PIEZAS_POR_OLA = 3;
export const PIEZAS_EXPLOSION = 36;

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

/** Piezas de una oleada. Determinista: la misma `semilla` da siempre las mismas piezas. */
export function piezasConfeti(semilla: number, cantidad = PIEZAS_EXPLOSION): PiezaConfeti[] {
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
      retraso: Math.round(azar() * 100) / 1000,
      duracion: 1.7 + Math.round(azar() * 900) / 1000,
      tono: Math.floor(azar() * TONOS.length),
    };
  });
}

interface PiezaViva extends PiezaConfeti {
  id: number;
  /** Hora (ms) a la que termina su caída: entonces se quita. */
  fin: number;
}

/**
 * Confeti de una celebración. Se monta con `key` = número de celebración.
 * `emitiendo`: mientras sea true sigue saliendo; al pasar a false, se deja caer lo que queda.
 */
export function Confeti({ semilla, emitiendo, alTerminar }: { semilla: number; emitiendo: boolean; alTerminar: () => void }) {
  const [piezas, setPiezas] = useState<PiezaViva[]>([]);
  const ola = useRef(0);
  const siguienteId = useRef(0);
  const emite = useRef(emitiendo);
  emite.current = emitiendo;

  useEffect(() => {
    const agregar = (cantidad: number) => {
      const ahora = Date.now();
      const nuevas = piezasConfeti(semilla * 10007 + ola.current++, cantidad).map((p) => ({
        ...p, id: siguienteId.current++, fin: ahora + (p.retraso + p.duracion) * 1000 + 100,
      }));
      setPiezas((vivas) => [...vivas.filter((p) => p.fin > ahora), ...nuevas]);
    };
    agregar(PIEZAS_EXPLOSION);
    const intervalo = setInterval(() => {
      if (emite.current) { agregar(PIEZAS_POR_OLA); return; }
      // Ya no emite: se quitan las que terminaron y, cuando no queda ninguna, se avisa.
      const ahora = Date.now();
      setPiezas((vivas) => {
        const quedan = vivas.filter((p) => p.fin > ahora);
        return quedan.length === vivas.length ? vivas : quedan;
      });
    }, OLA_MS);
    return () => clearInterval(intervalo);
  }, [semilla]);

  useEffect(() => {
    if (!emitiendo && piezas.length === 0) alTerminar();
  }, [emitiendo, piezas.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="confeti-meta" aria-hidden="true">
      {piezas.map((p) => (
        <span
          key={p.id}
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
