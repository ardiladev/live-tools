// =============================================================================
// widgets/pantalla/Tarjetas.tsx — Modo «tarjetas» de "Bailarinas en pantalla"
//
// Una tarjeta de cristal por bailarina: su foto en un círculo de su color, su nombre y lo que
// lleva en el LIVE; debajo, la barra de su meta de la noche y sus mayores apoyos (1.º, 2.º, 3.º).
// En columna (al costado de la pantalla) o en fila (arriba o abajo). Al cumplir la meta, la
// tarjeta brilla unos segundos con «¡Meta cumplida!» y suena una campanita.
// Estilos: pantalla.css (sección 2).
// =============================================================================

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Fotos } from '../../componentes/Fotos';
import { useCifraAnimada } from '../../hooks/useCifraAnimada';
import type { LiveEnPantalla } from '../../nucleo/nube';
import { esperar, sonar } from '../../nucleo/sonido';
import { conAlfa } from '../duelo/config';
import type { AjustesPantallaWidget } from './config';
import { armarTarjetas, type Tarjeta } from './motor';

const CELEBRACION_MS = 4500;
const formato = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

/** Tres notas que suben: la meta de una bailarina se cumplió. */
async function sonarMeta(): Promise<void> {
  for (const frecuencia of [784, 988, 1319]) {
    sonar({ frecuencia, duracion: 0.32, volumen: 0.12, onda: 'triangle', subida: 1 });
    await esperar(130);
  }
}

/**
 * Las bailarinas que acaban de cumplir su meta (id → veces). La primera vez que se ve a cada una
 * solo se anota (al abrir el widget a mitad del LIVE no se celebra lo que ya estaba cumplido); lo
 * mismo al cambiar de LIVE (`sesion`).
 */
function useCelebraciones(tarjetas: readonly Tarjeta[], sesion: string, sonido: boolean): Map<string, number> {
  const vistas = useRef(new Map<string, number>());
  const sesionVista = useRef(sesion);
  const [celebrando, setCelebrando] = useState(new Map<string, number>());
  const firma = tarjetas.map((t) => `${t.bailarina.id}:${t.meta.cumplidas}`).join('|');

  useEffect(() => {
    // Otro LIVE (o de los datos de ejemplo a los de verdad): se vuelve a anotar sin celebrar.
    if (sesionVista.current !== sesion) {
      sesionVista.current = sesion;
      vistas.current.clear();
    }
    const nuevas: [string, number][] = [];
    for (const t of tarjetas) {
      const antes = vistas.current.get(t.bailarina.id);
      if (antes !== undefined && t.meta.cumplidas > antes) nuevas.push([t.bailarina.id, t.meta.cumplidas]);
      vistas.current.set(t.bailarina.id, t.meta.cumplidas);
    }
    if (!nuevas.length) return;
    if (sonido) void sonarMeta();
    setCelebrando((antes) => new Map([...antes, ...nuevas]));
    // Sin limpieza a propósito: si llega otra lectura antes, la celebración sigue hasta el final.
    setTimeout(() => {
      setCelebrando((antes) => {
        const quedan = new Map(antes);
        for (const [id] of nuevas) quedan.delete(id);
        return quedan;
      });
    }, CELEBRACION_MS);
  }, [firma, sesion]); // eslint-disable-line react-hooks/exhaustive-deps

  return celebrando;
}

/** El color de la bailarina y sus versiones traslúcidas (sin color-mix: OBS viejo lo pinta negro). */
export const coloresBailarina = (color: string): CSSProperties =>
  ({ '--color': color, '--color-suave': conAlfa(color, 0.4), '--color-brillo': conAlfa(color, 0.55) } as CSSProperties);

export function Tarjetas({ cfg, live }: { cfg: AjustesPantallaWidget; live: LiveEnPantalla }) {
  const tarjetas = armarTarjetas(cfg, live);
  const celebrando = useCelebraciones(tarjetas, live.sesion, cfg.sonido);
  return (
    <main className={`pantalla-tarjetas ${cfg.direccion === 'h' ? 'en-fila' : 'en-columna'}`} style={{ '--n': Math.max(1, tarjetas.length) } as CSSProperties}>
      {tarjetas.map((t) => (
        <TarjetaBailarina key={t.bailarina.id} t={t} cfg={cfg} celebra={celebrando.get(t.bailarina.id) || 0} />
      ))}
    </main>
  );
}

function TarjetaBailarina({ t, cfg, celebra }: { t: Tarjeta; cfg: AjustesPantallaWidget; celebra: number }) {
  const { bailarina: b, meta } = t;
  const mostrado = useCifraAnimada(t.monedas, { ms: 900 });
  const porcentaje = Math.round(meta.fraccion * 100);
  const textoCelebra = cfg.escalonada && celebra > 1 ? `¡Meta ×${celebra}!` : '¡Meta cumplida!';
  const clases = ['tarjeta-bailarina', 'cristal', celebra ? 'celebra' : '', meta.cumplidas && !cfg.escalonada ? 'cumplida' : ''].filter(Boolean).join(' ');

  return (
    <section className={clases} style={coloresBailarina(b.color)}>
      <div className="cabeza">
        <span className="circulo con-fotos">
          <span className="inicial">{b.nombre.charAt(0).toUpperCase()}</span>
          <Fotos ids={b.fotos} />
        </span>
        <div className="datos">
          <div className="nombre">{b.nombre}</div>
          <div className="lleva">
            <span className="cifra">{formato.format(Math.round(mostrado))}</span>
            <span className="unidad">monedas</span>
          </div>
        </div>
      </div>

      {cfg.conMeta ? (
        <div className="meta-bailarina">
          <div className="barra">
            <div className="relleno" style={{ width: `${porcentaje}%` }} />
          </div>
          <div className="texto-meta">
            <span>{`Meta ${formato.format(meta.objetivo)}`}</span>
            <span>{`${porcentaje} %`}</span>
          </div>
        </div>
      ) : null}

      {cfg.fans > 0 ? (
        <ol className="fans">
          {t.fans.map(([apodo, m], i) => (
            <li key={`${i}-${apodo}`} className={`puesto-${i + 1}`}>
              <span className="puesto">{i + 1}</span>
              <span className="apodo">{apodo}</span>
              {cfg.monedasFans ? <span className="monedas-fan">{formato.format(m)}</span> : null}
            </li>
          ))}
          {!t.fans.length ? <li className="sin-fans">Envía su activador para apoyarla</li> : null}
        </ol>
      ) : null}

      {celebra ? <div className="cartel-meta" aria-live="polite">{textoCelebra}</div> : null}
    </section>
  );
}
