// =============================================================================
// widgets/carrera/Carrera.tsx — Widget "Carrera de regalos" (carrera.html, 1920 × 400)
//
// Una franja con una tarjeta de cristal por integrante (regalo, nombre, puntaje y barra hacia
// su meta) a cada lado del reloj de la ronda; al terminar, el cartel del ganador. Las reglas
// están en motor.ts; aquí solo se pinta. Estilos: carrera.css (portado tal cual).
// Secciones: 1. Widget · 2. Tarjeta de integrante · 3. Reloj · 4. Ganador
// =============================================================================

import { useEffect, useRef, type CSSProperties } from 'react';
import { PildoraEstado } from '../../componentes/PildoraEstado';
import { useCifraAnimada } from '../../hooks/useCifraAnimada';
import { useMotor } from '../../hooks/useMotor';
import { useReiniciarAnimacion } from '../../hooks/useReiniciarAnimacion';
import { useRondaReloj } from '../../hooks/useRondaReloj';
import { useWidget } from '../../hooks/useWidget';
import { formatoReloj } from '../../nucleo/reloj';
import type { EstadoReloj, LecturaReloj } from '../../tipos/reloj';
import type { IntegranteCarrera } from './config';
import { crearMotorCarrera, type EstadoCarrera, type MotorCarrera } from './motor';
import './carrera.css';

const CONTEO_MS = 700; // duración de la animación del número
const ESTADOS: Record<EstadoReloj, string> = { listo: 'Lista', corre: 'En juego', pausa: 'En pausa', fin: 'Final' };
const formato = new Intl.NumberFormat('es-CO');

/** La puntuación más alta (0 si nadie suma) y quiénes la tienen. */
function lideres(e: EstadoCarrera): { maximo: number; ganadores: IntegranteCarrera[] } {
  const maximo = Math.max(0, ...e.integrantes.map((j) => e.puntos[j.id] || 0));
  return { maximo, ganadores: e.integrantes.filter((j) => maximo > 0 && (e.puntos[j.id] || 0) === maximo) };
}


// -----------------------------------------------------------------------------
// 1. Widget
// -----------------------------------------------------------------------------

export function Carrera() {
  const [estado, motor] = useMotor(crearMotorCarrera);
  const widget = useWidget({ alConfig: motor.aplicarConfig, alEvento: motor.alEvento });
  const lectura = useRondaReloj(estado.reloj);

  // Sonidos del reloj (tic final y campana): cuando cambia el estado o el segundo mostrado.
  const segundo = Math.ceil(lectura.restanteMs / 1000);
  useEffect(() => { motor.alPintarReloj(lectura); }, [lectura.estado, segundo]);

  const terminado = lectura.estado === 'fin';
  const { maximo, ganadores } = lideres(estado);
  // Mitad a la izquierda del reloj y mitad a la derecha (con impares, uno más a la izquierda).
  const mitad = Math.ceil(estado.integrantes.length / 2);
  const tarjeta = (j: IntegranteCarrera) => (
    <TarjetaIntegrante
      key={j.id}
      integrante={j}
      estado={estado}
      motor={motor}
      lider={maximo > 0 && (estado.puntos[j.id] || 0) === maximo}
      atenuado={terminado && maximo > 0 && !ganadores.includes(j)}
    />
  );

  return (
    <>
      <main className="escena">
        {/* Integrantes a la izquierda · reloj · integrantes a la derecha */}
        <div className={estado.integrantes.length ? 'carrera' : 'carrera sin-integrantes'} id="carrera">
          <div className="lado" id="izquierda">{estado.integrantes.slice(0, mitad).map(tarjeta)}</div>
          <Reloj titulo={estado.titulo} lectura={lectura} />
          <div className="lado" id="derecha">{estado.integrantes.slice(mitad).map(tarjeta)}</div>
        </div>
        <Ganador
          visible={terminado && estado.integrantes.length > 0}
          maximo={maximo}
          ganadores={ganadores}
        />
      </main>
      <PildoraEstado widget={widget} />
    </>
  );
}


// -----------------------------------------------------------------------------
// 2. Tarjeta de un integrante
// -----------------------------------------------------------------------------

interface PropsTarjeta {
  integrante: IntegranteCarrera;
  estado: EstadoCarrera;
  motor: MotorCarrera;
  lider: boolean;
  atenuado: boolean;
}

function TarjetaIntegrante({ integrante: j, estado, motor, lider, atenuado }: PropsTarjeta) {
  const nodo = useRef<HTMLElement>(null);
  const valor = estado.puntos[j.id] || 0;
  const golpes = estado.golpes[j.id] || 0;
  const mostrado = useCifraAnimada(valor, { ms: CONTEO_MS, animar: estado.animarPuntos, pintada: estado.pintadas });
  useReiniciarAnimacion(nodo, 'golpe', golpes);

  const porcentaje = Math.min(100, Math.floor((valor / j.meta) * 100));
  const lograda = valor >= j.meta;
  const imagen = j.imagen || estado.imagenesAprendidas[j.id] || '';
  const clases = ['integrante', 'cristal', lograda && 'lograda', lider && 'lider', atenuado && 'atenuado', golpes > 0 && 'golpe']
    .filter(Boolean).join(' ');

  return (
    <article ref={nodo} className={clases} style={{ '--color': j.color } as CSSProperties}>
      <span className="corona" aria-hidden="true">♛</span>
      <div className="cabeza">
        <div className="regalo">
          <img alt="" src={imagen || undefined} hidden={!imagen} />
          <span className="sin-imagen" aria-hidden="true" hidden={Boolean(imagen)}>🎁</span>
        </div>
        <div className="nombre">{j.nombre}</div>
      </div>
      <div className="puntos">{formato.format(mostrado)}</div>
      <div className="barra filo-oro"><div className="relleno" style={{ width: `${porcentaje}%` }} /></div>
      <div className="pie">
        <span className="porcentaje">{lograda ? '¡Meta!' : `${porcentaje}%`}</span>
        <span className="objetivo">{`Meta ${formato.format(j.meta)}`}</span>
      </div>
      {estado.sumas.filter((s) => s.integrante === j.id).map((s) => (
        <span key={s.id} className="suma" onAnimationEnd={() => motor.quitarSuma(s.id)}>{`+${formato.format(s.suma)}`}</span>
      ))}
    </article>
  );
}


// -----------------------------------------------------------------------------
// 3. Reloj de la ronda
// -----------------------------------------------------------------------------

function Reloj({ titulo, lectura }: { titulo: string; lectura: LecturaReloj }) {
  const { estado, restanteMs, duracionMs } = lectura;
  const urgente = estado === 'corre' && restanteMs <= 10000;
  return (
    <div
      className={urgente ? 'reloj cristal urgente' : 'reloj cristal'}
      id="reloj"
      data-estado={estado}
      style={{ '--avance': String(Math.min(1, restanteMs / duracionMs)) } as CSSProperties}
    >
      <div className="titulo" id="titulo">{titulo}</div>
      <div className="anillo">
        <div className="tiempo" id="tiempo">{formatoReloj(restanteMs)}</div>
      </div>
      <div className="estado-reloj" id="estado-reloj">{ESTADOS[estado]}</div>
    </div>
  );
}


// -----------------------------------------------------------------------------
// 4. Al terminar la ronda: quién ganó
// -----------------------------------------------------------------------------

function Ganador({ visible, maximo, ganadores }: { visible: boolean; maximo: number; ganadores: IntegranteCarrera[] }) {
  const nombres = ganadores.map((j) => j.nombre);
  const texto = !ganadores.length
    ? 'Tiempo terminado'
    : ganadores.length === 1
      ? `Gana ${nombres[0]} · ${formato.format(maximo)}`
      : `Empate: ${nombres.join(' y ')} · ${formato.format(maximo)}`;
  return (
    <div className="ganador cristal" id="ganador" role="status" aria-live="polite" hidden={!visible}>
      <span className="trofeo" aria-hidden="true">🏆</span>
      <span id="ganador-texto">{visible ? texto : ''}</span>
    </div>
  );
}
