// =============================================================================
// widgets/repertorio/Repertorio.tsx — Widget "Repertorio" (repertorio.html, 600 × 900)
//
// Una lista vertical de canciones o bailes; los regalos llenan la barra de la canción activa y,
// al llegar a su meta, se desbloquea ("Sonando"). Las tarjetas se reusan por id (key): al
// cambiar la activa, cambian de estado con transiciones en vez de aparecer de nuevo.
// Reglas en motor.ts; estilos en repertorio.css (portado tal cual).
// =============================================================================

import { useRef } from 'react';
import { PildoraEstado } from '../../componentes/PildoraEstado';
import { useCifraAnimada } from '../../hooks/useCifraAnimada';
import { useMotor } from '../../hooks/useMotor';
import { useReiniciarAnimacion } from '../../hooks/useReiniciarAnimacion';
import { useWidget } from '../../hooks/useWidget';
import type { Cancion } from './config';
import {
  crearMotorRepertorio, estadoDe, ventana, type EstadoCancion, type EstadoRepertorio,
} from './motor';
import './repertorio.css';

const CONTEO_MS = 500; // duración de la animación de las cifras
const formato = new Intl.NumberFormat('es-CO');

const TEXTOS: Record<EstadoCancion, (juntado: number, c: Cancion) => string> = {
  pendiente: () => 'En espera',
  activa: (juntado, c) => `Faltan ${formato.format(Math.max(0, c.meta - juntado))} monedas`,
  sonando: () => 'Desbloqueada · Sonando',
  hecha: () => 'Hecha',
};

export function Repertorio() {
  const [estado, motor] = useMotor(crearMotorRepertorio);
  const widget = useWidget({ alConfig: motor.aplicarConfig, alEvento: motor.alEvento });
  const vistas = ventana(estado);

  return (
    <>
      <main className="escena">
        <div className="titulo" id="titulo">{estado.titulo}</div>
        <div className={vistas.length ? 'lista' : 'lista vacia'} id="lista">
          {vistas.map((c) => <TarjetaCancion key={c.id} cancion={c} estado={estado} />)}
        </div>
      </main>
      <PildoraEstado widget={widget} />
    </>
  );
}

/** Tarjeta de una canción. El estado va en data-estado: pendiente | activa | sonando | hecha. */
function TarjetaCancion({ cancion: c, estado }: { cancion: Cancion; estado: EstadoRepertorio }) {
  const nodo = useRef<HTMLElement>(null);
  const juntado = estado.monedas[c.id] || 0;
  const situacion = estadoDe(estado, c);
  const mostrado = useCifraAnimada(juntado, { ms: CONTEO_MS, animar: estado.animarCifras });
  // Destello al recibir un regalo; uno más largo al desbloquearse.
  const golpe = useReiniciarAnimacion(nodo, 'golpe', estado.golpes[c.id] || 0);
  const desbloqueo = useReiniciarAnimacion(nodo, 'desbloqueo', estado.desbloqueos[c.id] || 0);
  const clases = ['cancion', 'cristal', golpe && 'golpe', desbloqueo && 'desbloqueo'].filter(Boolean).join(' ');

  return (
    <article ref={nodo} className={clases} data-estado={situacion}>
      <div className="icono">
        <span className="numero">{String(estado.canciones.indexOf(c) + 1).padStart(2, '0')}</span>
        {/* Sonando: triángulo de reproducir · Hecha: visto */}
        <svg className="reproducir" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" /></svg>
        <svg className="visto" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
      </div>
      <div className="cuerpo">
        <div className="nombre">{c.nombre}</div>
        <div className="estado">{TEXTOS[situacion](juntado, c)}</div>
        <div className="barra"><div className="relleno" style={{ width: `${Math.min(100, (juntado / c.meta) * 100)}%` }} /></div>
        <div className="cifras">{`${formato.format(mostrado)} / ${formato.format(c.meta)}`}</div>
      </div>
    </article>
  );
}
