// =============================================================================
// componentes/FinalJuego.tsx — «Al terminar» una ronda (Batalla, Barra de activación, Duelo VS)
//
//   <FinalJuego reloj={estado.reloj} lectura={lectura} puntos={…} equipos={…} final={…} ronda={…} widget={w} />
//
// Cuando la ronda termina del todo (pasados los 3 s de gracia):
//   - anota en Supabase quién ganó (una vez por ronda; lo usa el Torneo por llaves);
//   - si hay castigos (`cs`) y alguien perdió, gira una ruleta de castigos para quien perdió y
//     muestra el resultado unos segundos; si hay Cola de retos (`rc`), se lo manda también.
// La ruleta solo gira si se VIO terminar la ronda: al recargar OBS con la ronda ya terminada no
// vuelve a aparecer. Las reglas están en src/nucleo/final.ts. Estilos: finalJuego.css.
// =============================================================================

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { castigoDeRonda, mandarResultado, perdedorDe, unaVezPorRonda, type Final } from '../nucleo/final';
import { GRACIA_MS, mandarReto } from '../nucleo/juego';
import { sonar } from '../nucleo/sonido';
import type { LecturaReloj, RelojRonda } from '../tipos/reloj';
import './finalJuego.css';

export const GIRO_MS = 5000;        // lo que tarda la ruleta en frenar
export const RESULTADO_MS = 12000;  // cuánto queda el castigo a la vista

interface EquipoFinal {
  nombre: string;
  color: string;
}

export interface PropsFinalJuego {
  reloj: RelojRonda;
  lectura: LecturaReloj;
  puntos: readonly number[];
  equipos: readonly EquipoFinal[];
  final: Final;
  ronda: number;
  /** El `w` del widget (sin él, no se anota nada en Supabase). */
  widget?: string;
  sonido: boolean;
}

/** ¿Terminó la ronda del todo (pasada la gracia)? Vuelve a pintar justo cuando se cumple. */
function useRondaCerrada(lectura: LecturaReloj, reloj: RelojRonda): boolean {
  const fin = Number(reloj.fin) || 0;
  const [, repintar] = useState(0);
  const cerrada = lectura.estado === 'fin' && Date.now() - fin >= GRACIA_MS;
  useEffect(() => {
    if (lectura.estado !== 'fin' || cerrada) return undefined;
    const espera = setTimeout(() => repintar((n) => n + 1), Math.max(0, fin + GRACIA_MS - Date.now()) + 30);
    return () => clearTimeout(espera);
  }, [lectura.estado, fin, cerrada]);
  return cerrada;
}

export function FinalJuego({ reloj, lectura, puntos, equipos, final, ronda, widget, sonido }: PropsFinalJuego) {
  const cerrada = useRondaCerrada(lectura, reloj);
  const perdedor = perdedorDe(puntos);
  const maximo = Math.max(0, ...puntos);
  const ganador = maximo > 0 && puntos.filter((p) => p === maximo).length === 1 ? puntos.indexOf(maximo) : -1;
  const indice = castigoDeRonda(final.castigos.length, ronda);
  const castigo = final.castigos[indice] ?? '';

  // 1. El resultado de la ronda, a Supabase (una vez por ronda).
  useEffect(() => {
    if (cerrada) mandarResultado(widget, ronda, { g: ganador, p: [...puntos] });
  }, [cerrada, ronda]); // eslint-disable-line react-hooks/exhaustive-deps

  // 2. La ruleta de castigos: solo si se vio terminar la ronda en esta página.
  const [fase, setFase] = useState<'nada' | 'gira' | 'resultado'>('nada');
  const antes = useRef(cerrada);
  useEffect(() => {
    const recienCerrada = cerrada && !antes.current;
    antes.current = cerrada;
    if (!cerrada) {
      setFase('nada');
      return undefined;
    }
    if (!recienCerrada || perdedor === null || !castigo) return undefined;
    setFase('gira');
    if (sonido) sonar({ frecuencia: 440, duracion: 0.4, subida: 1.6 });
    const t1 = setTimeout(() => {
      setFase('resultado');
      if (sonido) sonar({ frecuencia: 330, duracion: 0.8, subida: 0.6 });
      // A la Cola de retos (una vez por ronda), como un reto más.
      if (final.cola) {
        unaVezPorRonda('castigo', widget, ronda, () => {
          void mandarReto(final.cola, { texto: castigo, usuario: equipos[perdedor]?.nombre || '', origen: 'Castigo' });
        });
      }
    }, GIRO_MS);
    const t2 = setTimeout(() => setFase('nada'), GIRO_MS + RESULTADO_MS);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [cerrada]); // eslint-disable-line react-hooks/exhaustive-deps

  if (fase === 'nada' || perdedor === null || !castigo) return null;
  const quien = equipos[perdedor];
  return (
    <div className="final-juego" data-fase={fase} role="status" aria-live="polite">
      <Rueda castigos={final.castigos} indice={indice} girando={fase === 'gira'} />
      <div className="final-juego-tarjeta cristal" style={{ '--color': quien?.color || 'var(--activo)' } as CSSProperties}>
        <div className="final-juego-quien">{`Castigo para ${quien?.nombre || 'quien perdió'}`}</div>
        <div className="final-juego-texto">{fase === 'resultado' ? castigo : 'Girando…'}</div>
      </div>
    </div>
  );
}

/** La ruleta: sectores con conic-gradient y una flecha arriba; frena en el castigo `indice`. */
function Rueda({ castigos, indice, girando }: { castigos: readonly string[]; indice: number; girando: boolean }) {
  const n = castigos.length;
  const sector = 360 / n;
  const fondo = castigos
    .map((_, i) => `var(${i % 2 ? '--rueda-b' : '--rueda-a'}) ${i * sector}deg ${(i + 1) * sector}deg`)
    .join(', ');
  // Se pinta primero sin girar y, en el cuadro siguiente, con el giro (así la transición se ve).
  const [angulo, setAngulo] = useState(0);
  useEffect(() => {
    const destino = 360 * 6 - (indice * sector + sector / 2);
    const cuadro = requestAnimationFrame(() => setAngulo(destino));
    return () => cancelAnimationFrame(cuadro);
  }, [indice, sector]);
  return (
    <div className="rueda-castigos">
      <span className="rueda-flecha" aria-hidden="true" />
      <div
        className="rueda-disco"
        style={{ background: `conic-gradient(${fondo})`, transform: `rotate(${angulo}deg)`, transitionDuration: girando ? `${GIRO_MS}ms` : '0ms' }}
      >
        {castigos.map((texto, i) => (
          <span key={i} className={i % 2 ? 'rueda-etiqueta' : 'rueda-etiqueta sobre-claro'} style={{ transform: `rotate(${i * sector + sector / 2}deg)` }}>
            <span>{texto.length > 16 ? `${texto.slice(0, 15)}…` : texto}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
