// =============================================================================
// widgets/activacion/Subasta.tsx — Modo «Subasta de canciones» de la Barra de activación
//
// Las mismas reglas de la barra (motor.ts): cada «equipo» es una canción; quien envía su
// activador (o escribe su nombre en el chat, si está encendido) puja por ella y desde ahí todos
// sus regalos suman a esa canción. Lo que cambia es cómo se ve: un tablero de subasta con las
// canciones ordenadas por lo que llevan, la puja más alta con el martillo y, al terminar el
// reloj, «¡Se baila: …!» con quien más pujó por ella. Estilos: subasta.css.
// =============================================================================

import { useRef, type CSSProperties } from 'react';
import { conFotos, Fotos } from '../../componentes/Fotos';
import { useCifraAnimada } from '../../hooks/useCifraAnimada';
import { useReiniciarAnimacion } from '../../hooks/useReiniciarAnimacion';
import { formatoReloj } from '../../nucleo/reloj';
import type { EstadoReloj, LecturaReloj } from '../../tipos/reloj';
import { quienGana, type EstadoActivacion, type MotorActivacion } from './motor';
import './subasta.css';

const ESTADOS: Record<EstadoReloj, string> = { listo: 'Abre pronto', corre: 'Subasta abierta', pausa: 'En pausa', fin: 'Subasta cerrada' };
const formato = new Intl.NumberFormat('es-CO');

/** El orden de las canciones en el tablero: la que más lleva arriba (empates: en su orden). */
export function ordenSubasta(puntos: readonly number[]): number[] {
  return puntos.map((p, i) => [p, i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]).map(([, i]) => i);
}

export function Subasta({ estado, motor, lectura, titulo }: { estado: EstadoActivacion; motor: MotorActivacion; lectura: LecturaReloj; titulo: string }) {
  const { equipos, puntos } = estado;
  const lider = quienGana(puntos);
  const maximo = Math.max(1, ...puntos);
  const orden = ordenSubasta(puntos.slice(0, equipos.length));
  const fin = lectura.estado === 'fin';
  const urgente = lectura.estado === 'corre' && lectura.restanteMs <= 10000;
  const ganadora = fin && lider !== null ? equipos[lider] : undefined;
  const hayPujas = Math.max(0, ...puntos) > 0;
  const aviso = estado.avisoUnion && Date.now() < estado.avisoUnion.hasta
    ? estado.avisoUnion.texto.replace(' se unió a ', ' puja por ').replace(' se cambió a ', ' ahora puja por ')
    : fin ? (ganadora ? '' : hayPujas ? 'Empate: ¡que decida la bailarina!' : 'Nadie pujó')
      : lider !== null ? `Puja más alta: ${equipos[lider]?.nombre}` : estado.invitacion.replace('unirte a un equipo', 'pujar por una canción').replace('de un equipo', 'de una canción');

  return (
    <main className="subasta-escena">
      <header className="subasta-cabecera">
        <span className="subasta-titulo">{titulo}</span>
        <span className={urgente ? 'subasta-reloj cristal urgente' : 'subasta-reloj cristal'} role="timer" data-estado={lectura.estado}>
          <span className="tiempo">{formatoReloj(lectura.restanteMs)}</span>
          <span className="estado-reloj">{ESTADOS[lectura.estado]}</span>
        </span>
      </header>

      <ol className="tablero cristal" style={{ '--filas': equipos.length } as CSSProperties}>
        {equipos.map((e, i) => (
          <Fila
            key={i}
            indice={i}
            puesto={orden.indexOf(i)}
            estado={estado}
            motor={motor}
            fraccion={(puntos[i] ?? 0) / maximo}
            lider={lider === i}
            perdio={fin && lider !== null && lider !== i}
            color={e.color}
          />
        ))}
      </ol>

      {ganadora ? (
        <div className="se-baila cristal" style={{ '--color': ganadora.color } as CSSProperties} aria-live="polite">
          <span className="martillo" aria-hidden="true">🔨</span>
          <span className="etiqueta-se-baila">¡Se baila!</span>
          <span className="cancion-ganadora">{ganadora.nombre}</span>
          {lider !== null && estado.mejores[lider] ? <span className="mejor-postor">{`Mejor postor: ${estado.mejores[lider]}`}</span> : null}
        </div>
      ) : (
        <div className="aviso-subasta" role="status" aria-live="polite">{aviso}</div>
      )}
    </main>
  );
}

function Fila({ indice: i, puesto, estado, motor, fraccion, lider, perdio, color }: {
  indice: number; puesto: number; estado: EstadoActivacion; motor: MotorActivacion; fraccion: number; lider: boolean; perdio: boolean; color: string;
}) {
  const e = estado.equipos[i];
  const nodo = useRef<HTMLLIElement>(null);
  const golpe = useReiniciarAnimacion(nodo, 'golpe', estado.golpes[i] ?? 0);
  const mostrado = useCifraAnimada(estado.puntos[i] ?? 0, { ms: 500, animar: estado.animarCifras, pintada: estado.pintadas });
  if (!e) return null;
  const clases = ['fila-subasta', lider && 'lider', perdio && 'perdio', golpe && 'golpe'].filter(Boolean).join(' ');
  return (
    <li className={clases} ref={nodo} style={{ '--color': color, '--puesto': puesto } as CSSProperties}>
      <span className="puesto-subasta">{puesto + 1}</span>
      <span className={conFotos(e.fotos) ? 'icono-subasta con-fotos' : 'icono-subasta'}>
        <img alt="" src={e.imagen || undefined} hidden={!e.imagen} />
        {!e.imagen ? <span className="inicial">{e.nombre.charAt(0).toUpperCase()}</span> : null}
        <Fotos ids={e.fotos} />
      </span>
      <span className="cuerpo-subasta">
        <span className="nombre-cancion">
          {e.nombre}
          {lider ? <span className="insignia-puja">Puja más alta</span> : null}
        </span>
        <span className="barra-subasta"><span className="relleno-subasta" style={{ width: `${Math.round(fraccion * 100)}%` }} /></span>
        <span className="detalle-subasta">
          {`👥 ${estado.miembros[i] ?? 0}`}
          {estado.mejores[i] ? ` · ⭐ ${estado.mejores[i]}` : ''}
        </span>
      </span>
      <span className="monedas-subasta">{formato.format(mostrado)}</span>
      {estado.sumas.filter((s) => s.equipo === i).map((s) => (
        <span key={s.id} className="suma-subasta" onAnimationEnd={() => motor.quitarSuma(s.id)}>{`+${formato.format(s.suma)}`}</span>
      ))}
    </li>
  );
}
