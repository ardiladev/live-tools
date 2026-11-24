// =============================================================================
// widgets/torneo/Torneo.tsx — Widget "Torneo por llaves" (torneo.html, 1920 × 1080)
//
// El cuadro de eliminación: una columna por ronda (cuartos, semifinal, final) y, a la derecha,
// la campeona con su corona. Cada cruce muestra a las dos bailarinas con su foto; quien ganó
// queda iluminada y quien perdió, apagada; el cruce que se está jugando brilla con «En juego».
// Todo lo decide el panel (src/panel/vistas/torneo): este widget solo pinta. Estilos: torneo.css.
// =============================================================================

import { useState, type CSSProperties } from 'react';
import { Fotos } from '../../componentes/Fotos';
import { PildoraEstado } from '../../componentes/PildoraEstado';
import { useWidget } from '../../hooks/useWidget';
import { normalizarRondas, type ConfigTorneo, type Lugar, type PartidoTorneo } from './config';
import './torneo.css';

const nombreRonda = (cruces: number): string =>
  (cruces === 1 ? 'Final' : cruces === 2 ? 'Semifinal' : cruces === 4 ? 'Cuartos de final' : `Ronda de ${cruces * 2}`);

export function Torneo() {
  const [cfg, setCfg] = useState<{ titulo: string; rondas: PartidoTorneo[][]; actual: [number, number] | null }>({ titulo: '', rondas: [], actual: null });
  const widget = useWidget<ConfigTorneo>({
    alConfig: (c) => setCfg({
      titulo: String(c.ti || '').slice(0, 40),
      rondas: normalizarRondas(c.r),
      actual: Array.isArray(c.ac) && c.ac.length === 2 ? [Number(c.ac[0]), Number(c.ac[1])] : null,
    }),
    alEvento: () => {},
  });

  const final = cfg.rondas[cfg.rondas.length - 1]?.[0];
  const campeona = final && final.ganador !== null ? (final.ganador === 0 ? final.a : final.b) : null;

  return (
    <>
      <main className="torneo">
        {cfg.titulo ? <h1 className="titulo">{cfg.titulo}</h1> : null}
        <div className="cuadro" style={{ '--rondas': cfg.rondas.length + 1 } as CSSProperties}>
          {cfg.rondas.map((ronda, r) => (
            <section key={r} className="ronda">
              <h2>{nombreRonda(ronda.length)}</h2>
              <div className="cruces">
                {ronda.map((p, i) => (
                  <Cruce key={i} partido={p} enJuego={cfg.actual?.[0] === r && cfg.actual?.[1] === i} />
                ))}
              </div>
            </section>
          ))}
          <section className="ronda campeona-columna">
            <h2>Campeona</h2>
            <div className="cruces">
              <div className={campeona ? 'campeona cristal coronada' : 'campeona cristal'}>
                <span className="corona" aria-hidden="true">♛</span>
                <Circulo lugar={campeona} grande />
                <div className="nombre">{campeona?.nombre || '¿Quién será?'}</div>
              </div>
            </div>
          </section>
        </div>
        {!cfg.rondas.length && widget.vistaPrevia ? <p className="vacio">Arma el cuadro en el panel (Juegos → Competencias → Torneo por llaves).</p> : null}
      </main>
      <PildoraEstado widget={widget} />
    </>
  );
}

function Cruce({ partido: p, enJuego }: { partido: PartidoTorneo; enJuego: boolean }) {
  const clase = (lado: 0 | 1): string => (p.ganador === null ? 'lugar' : p.ganador === lado ? 'lugar gano' : 'lugar perdio');
  return (
    <div className={enJuego ? 'cruce cristal en-juego' : 'cruce cristal'}>
      {enJuego ? <span className="etiqueta-juego">En juego</span> : null}
      {[p.a, p.b].map((l, i) => (
        <div key={i} className={clase(i as 0 | 1)} style={{ '--color': l?.color || 'transparent' } as CSSProperties}>
          <Circulo lugar={l} />
          <span className="nombre">{l?.nombre || (p.a || p.b ? 'Pase libre' : 'Por definir')}</span>
        </div>
      ))}
    </div>
  );
}

function Circulo({ lugar, grande = false }: { lugar: Lugar | null; grande?: boolean }) {
  return (
    <span className={grande ? 'circulo grande con-fotos' : 'circulo con-fotos'} style={{ '--color': lugar?.color || 'rgba(255,255,255,.2)' } as CSSProperties}>
      <span className="inicial">{lugar ? lugar.nombre.charAt(0).toUpperCase() : '?'}</span>
      {lugar ? <Fotos ids={lugar.fotos} /> : null}
    </span>
  );
}
