// =============================================================================
// widgets/activacion/Activacion.tsx — Widget "Barra de activación" (activacion.html, 1600 × 400)
//
// Arriba el reloj de la ronda; debajo, una placa de cristal con UNA barra repartida en 2 a 4
// cuadrantes (uno por equipo: su color, la imagen del activador y su porcentaje) y la leyenda
// (una ficha por equipo: nombre, monedas, personas unidas y quién aportó más). Abajo, el aviso.
// Reglas en motor.ts; estilos en activacion.css (portado tal cual).
// Cuadrantes y fichas se rehacen cuando cambia cuántos equipos hay (key con la cantidad), como
// en el original.
// Secciones: 1. Widget · 2. Cuadrante · 3. Ficha de un equipo
// =============================================================================

import { useEffect, useRef, type CSSProperties } from 'react';
import { PildoraEstado } from '../../componentes/PildoraEstado';
import { useCifraAnimada } from '../../hooks/useCifraAnimada';
import { useMotor } from '../../hooks/useMotor';
import { useReiniciarAnimacion } from '../../hooks/useReiniciarAnimacion';
import { useRondaReloj } from '../../hooks/useRondaReloj';
import { useWidget } from '../../hooks/useWidget';
import { formatoReloj } from '../../nucleo/reloj';
import type { EstadoReloj } from '../../tipos/reloj';
import type { EquipoActivacion } from './config';
import {
  ANCHO_ETIQUETA, anchos, avisoDe, crearMotorActivacion, quienGana, type EstadoActivacion, type MotorActivacion,
} from './motor';
import './activacion.css';

const CONTEO_MS = 500; // duración de la animación del número
const ESTADOS: Record<EstadoReloj, string> = { listo: 'Lista', corre: 'En juego', pausa: 'En pausa', fin: 'Final' };
const formato = new Intl.NumberFormat('es-CO');


// -----------------------------------------------------------------------------
// 1. Widget
// -----------------------------------------------------------------------------

export function Activacion() {
  const [estado, motor] = useMotor(crearMotorActivacion);
  const widget = useWidget({ alConfig: motor.aplicarConfig, alEvento: motor.alEvento });
  // El reloj se repinta cada 200 ms (setInterval: sigue aunque la página no se esté dibujando).
  const lectura = useRondaReloj(estado.reloj);

  // Sonidos del reloj y repintado al cambiar de estado: cuando cambia el estado o el segundo.
  const segundo = Math.ceil(lectura.restanteMs / 1000);
  useEffect(() => { motor.alPintarReloj(lectura); }, [lectura.estado, segundo]); // eslint-disable-line react-hooks/exhaustive-deps

  const { equipos, puntos } = estado;
  const total = puntos.reduce((a, b) => a + b, 0);
  const medidas = anchos(puntos);
  const lider = quienGana(puntos);
  const aviso = avisoDe(estado, lectura, Date.now());
  const urgente = lectura.estado === 'corre' && lectura.restanteMs <= 10000;
  const n = equipos.length;

  return (
    <>
      <main className="escena">
        {/* Reloj de la ronda */}
        <div className={urgente ? 'reloj cristal urgente' : 'reloj cristal'} id="reloj" role="timer" data-estado={lectura.estado}>
          <span className="tiempo" id="tiempo">{formatoReloj(lectura.restanteMs)}</span>
          <span className="estado-reloj" id="estado-reloj">{ESTADOS[lectura.estado]}</span>
        </div>

        <div className="placa cristal">
          {/* La barra: un cuadrante por equipo */}
          <div className="barra" id="barra">
            {equipos.map((e, i) => (
              <Cuadrante
                key={`${n}-${i}`}
                equipo={e}
                ancho={medidas[i] ?? 0}
                // Sin monedas todavía, no hay porcentaje. Un equipo con monedas nunca muestra "0%".
                porcentaje={!total ? '' : (puntos[i] ?? 0) && ((puntos[i] ?? 0) / total) * 100 < 0.5 ? '<1%' : `${Math.round(((puntos[i] ?? 0) / total) * 100)}%`}
                gana={lider === i}
              />
            ))}
          </div>
          {/* Debajo, cada equipo: nombre, monedas, personas unidas y quien aportó más */}
          <div className="leyenda" id="leyenda" data-cantidad={n}>
            {equipos.map((e, i) => (
              <Ficha key={`${n}-${i}`} equipo={e} indice={i} estado={estado} motor={motor} gana={lider === i} />
            ))}
          </div>
        </div>

        {/* Quién va ganando, quién se unió, quién ganó */}
        <div className="aviso-juego" id="aviso" role="status" aria-live="polite" style={{ '--color': aviso.color } as CSSProperties}>
          {aviso.texto}
        </div>
      </main>
      <PildoraEstado widget={widget} />
    </>
  );
}


// -----------------------------------------------------------------------------
// 2. Cuadrante de la barra (en uno muy angosto, la etiqueta se oculta)
// -----------------------------------------------------------------------------

function Cuadrante({ equipo: e, ancho, porcentaje, gana }: { equipo: EquipoActivacion; ancho: number; porcentaje: string; gana: boolean }) {
  const clases = ['cuadrante', ancho < ANCHO_ETIQUETA && 'angosto', gana && 'gana'].filter(Boolean).join(' ');
  return (
    <div className={clases} style={{ '--color': e.color, width: `${ancho}%` } as CSSProperties}>
      <img className="regalo" alt="" src={e.imagen || undefined} hidden={!e.imagen} />
      <span className="porcentaje">{porcentaje}</span>
    </div>
  );
}


// -----------------------------------------------------------------------------
// 3. Ficha de un equipo en la leyenda
// -----------------------------------------------------------------------------

interface PropsFicha {
  equipo: EquipoActivacion;
  indice: number;
  estado: EstadoActivacion;
  motor: MotorActivacion;
  gana: boolean;
}

function Ficha({ equipo: e, indice: i, estado, motor, gana }: PropsFicha) {
  const nodo = useRef<HTMLDivElement>(null);
  const golpe = useReiniciarAnimacion(nodo, 'golpe', estado.golpes[i] ?? 0);
  const mostrado = useCifraAnimada(estado.puntos[i] ?? 0, { ms: CONTEO_MS, animar: estado.animarCifras, pintada: estado.pintadas });
  const mejor = estado.mejores[i];
  const clases = ['ficha', gana && 'gana', golpe && 'golpe'].filter(Boolean).join(' ');

  return (
    <div className={clases} style={{ '--color': e.color } as CSSProperties} ref={nodo}>
      <div className="icono">
        <img className="regalo" alt="" src={e.imagen || undefined} hidden={!e.imagen} />
        <span className="inicial" aria-hidden="true">{e.imagen ? '' : e.nombre.charAt(0).toUpperCase()}</span>
      </div>
      <div className="datos">
        <div className="nombre">{e.nombre}</div>
        <div className="monedas">{formato.format(mostrado)}</div>
        <div className="detalle">
          {/* El espacio entre los dos es el del HTML original (antes del «·» de .mejor). */}
          <span className="miembros">{`👥 ${estado.miembros[i] ?? 0}`}</span>{' '}
          <span className="mejor">{mejor ? `⭐ ${mejor}` : ''}</span>
        </div>
      </div>
      {estado.sumas.filter((s) => s.equipo === i).map((s) => (
        <span key={s.id} className="suma" onAnimationEnd={() => motor.quitarSuma(s.id)}>{`+${formato.format(s.suma)}`}</span>
      ))}
    </div>
  );
}
