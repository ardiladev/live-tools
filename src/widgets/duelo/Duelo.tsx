// =============================================================================
// widgets/duelo/Duelo.tsx — Widget "Duelo VS" (duelo.html, pantalla completa: 1080 × 1920)
//
// Va ENCIMA de toda la escena: cada bailarina baila en una mitad de la pantalla y una línea
// divisoria de oro las separa. Arriba, el reloj, la barra de activación de 2 cuadrantes y la
// ficha de cada equipo (con el «VS» sobre la línea). Abajo, el aviso.
// Durante TODO el duelo, la mitad de quien va perdiendo ya se ve presa del efecto elegido
// (Efectos.tsx); si la pasa, se libera (el efecto se va) y el efecto cae sobre la otra.
// Al terminar el tiempo (y los 3 s de gracia), quien perdió se queda presa con su cartel y la
// mitad de quien ganó se ilumina. Así se queda hasta la próxima ronda.
// Reglas en motor.ts (las de la Barra de activación); diseño en duelo.css y efectos.css.
// Secciones: 1. Widget · 2. Mitad de la pantalla · 3. Cuadrante · 4. Ficha de un equipo
// =============================================================================

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { PildoraEstado } from '../../componentes/PildoraEstado';
import { useCifraAnimada } from '../../hooks/useCifraAnimada';
import { useMotor } from '../../hooks/useMotor';
import { useReiniciarAnimacion } from '../../hooks/useReiniciarAnimacion';
import { useRondaReloj } from '../../hooks/useRondaReloj';
import { useWidget } from '../../hooks/useWidget';
import { GRACIA_MS } from '../../nucleo/juego';
import { formatoReloj } from '../../nucleo/reloj';
import type { EstadoReloj } from '../../tipos/reloj';
import type { EquipoActivacion } from '../activacion/config';
import { anchos, avisoDe, quienGana } from '../activacion/motor';
import { conAlfa, mezclar, type ConfigDuelo, type Efecto as TipoEfecto } from './config';
import { Efecto, sonarEfecto, Victoria } from './Efectos';
import { crearMotorDuelo, faseDuelo, type EstadoDuelo, type FaseDuelo, type MotorDuelo } from './motor';
import './duelo.css';
import './efectos.css';

const CONTEO_MS = 500; // duración de la animación del número
const ESTADOS: Record<EstadoReloj, string> = { listo: 'Listo', corre: 'En juego', pausa: 'En pausa', fin: 'Final' };
const formato = new Intl.NumberFormat('es-CO');
const LADOS = ['izq', 'der'] as const;
/** Lo que tarda en irse el efecto cuando la bailarina se libera (la animación «liberar» de efectos.css). */
const SALIDA_MS = 700;

/** Colores de un equipo para el CSS (calculados aquí: sin color-mix, ver config.ts). */
const coloresDe = (color: string): CSSProperties => ({
  '--color': color,
  '--claro': mezclar(color, 0.35),
  '--oscuro': mezclar(color, -0.35),
  '--halo': conAlfa(color, 0.7),
} as CSSProperties);


// -----------------------------------------------------------------------------
// 1. Widget
// -----------------------------------------------------------------------------

export function Duelo() {
  const [estado, motor] = useMotor(crearMotorDuelo);
  const widget = useWidget<ConfigDuelo>({ alConfig: motor.aplicarConfig, alEvento: motor.alEvento });
  const lectura = useRondaReloj(estado.reloj);

  // Sonidos del reloj y repintado al cambiar de estado (como la Barra de activación).
  const segundo = Math.ceil(lectura.restanteMs / 1000);
  useEffect(() => { motor.alPintarReloj(lectura); }, [lectura.estado, segundo]); // eslint-disable-line react-hooks/exhaustive-deps

  // Al acabarse la gracia hay que volver a pintar (el reloj ya no cambia: está en 00:00).
  const [, repintar] = useState(0);
  const finReloj = Number(estado.reloj.fin) || 0;
  useEffect(() => {
    if (lectura.estado !== 'fin') return undefined;
    const falta = finReloj + GRACIA_MS - Date.now();
    if (falta <= 0) return undefined;
    const espera = setTimeout(() => repintar((n) => n + 1), falta + 30);
    return () => clearTimeout(espera);
  }, [lectura.estado, finReloj]);

  const duelo = faseDuelo(lectura, estado.reloj, estado.puntos, { enVivo: estado.enVivo });

  // El efecto suena solo si se vio caer (no al recargar OBS con la ronda ya terminada).
  const faseAnterior = useRef<FaseDuelo>(duelo.fase);
  useEffect(() => {
    if (faseAnterior.current === 'conteo' && duelo.fase === 'atrapada' && estado.sonido) sonarEfecto(estado.efecto);
    faseAnterior.current = duelo.fase;
  }, [duelo.fase]); // eslint-disable-line react-hooks/exhaustive-deps

  const { equipos, puntos } = estado;
  const total = puntos.reduce((a, b) => a + b, 0);
  const medidas = anchos(puntos);
  const lider = quienGana(puntos);
  const aviso = duelo.fase === 'conteo'
    ? { texto: '¡Tiempo! Contando los últimos regalos…', color: 'transparent' }
    : avisoDe(estado, lectura, Date.now());
  const urgente = lectura.estado === 'corre' && lectura.restanteMs <= 10000;

  return (
    <>
      <main className="duelo" data-fase={duelo.fase} data-efecto={estado.efecto}>
        {/* Las dos mitades de la pantalla (debajo de todo) */}
        {equipos.map((e, i) => (
          <Mitad
            key={`${estado.ronda}-${i}`}
            lado={LADOS[i] ?? 'izq'}
            equipo={e}
            efecto={estado.efecto}
            modo={duelo.perdedor === i ? 'atrapada' : duelo.ganador === i ? 'gana' : 'libre'}
            final={duelo.fase === 'atrapada'}
            estado={estado}
          />
        ))}

        {/* La línea divisoria, de arriba abajo */}
        <div className="divisoria" aria-hidden="true" />

        <header className="hud">
          <div className={urgente ? 'reloj cristal urgente' : 'reloj cristal'} role="timer" data-estado={lectura.estado}>
            <span className="tiempo">{formatoReloj(lectura.restanteMs)}</span>
            <span className="estado-reloj">{ESTADOS[lectura.estado]}</span>
          </div>

          {/* La barra de activación: un cuadrante por equipo, con chispas en la unión */}
          <div className="barra-duelo">
            {equipos.map((e, i) => (
              <Cuadrante
                key={i}
                equipo={e}
                ancho={medidas[i] ?? 0}
                porcentaje={!total ? '' : `${Math.round(((puntos[i] ?? 0) / total) * 100)}%`}
                gana={lider === i}
              />
            ))}
            <span className="costura" style={{ left: `${medidas[0] ?? 50}%` }} aria-hidden="true" />
          </div>

          <div className="fichas">
            {equipos.map((e, i) => (
              <Ficha key={i} equipo={e} indice={i} lado={LADOS[i] ?? 'izq'} estado={estado} motor={motor} gana={lider === i} />
            ))}
            <span className="vs" aria-hidden="true">VS</span>
          </div>
        </header>

        <div className="aviso-duelo" role="status" aria-live="polite" style={{ '--color': aviso.color } as CSSProperties}>
          {aviso.texto}
        </div>
      </main>
      <PildoraEstado widget={widget} />
    </>
  );
}


// -----------------------------------------------------------------------------
// 2. Mitad de la pantalla: libre, atrapada (durante el duelo o al final) o ganadora
// -----------------------------------------------------------------------------

type ModoMitad = 'libre' | 'atrapada' | 'gana';

function Mitad({ lado, equipo, efecto, modo, final, estado }: {
  lado: (typeof LADOS)[number]; equipo: EquipoActivacion; efecto: TipoEfecto; modo: ModoMitad; final: boolean; estado: EstadoDuelo;
}) {
  const atrapada = modo === 'atrapada';
  // Cada vez que vuelve a quedar atrapada, el efecto entra otra vez desde el principio (`vez`);
  // al liberarse no desaparece de golpe: se va durante SALIDA_MS (`saliendo`).
  const [antes, setAntes] = useState(atrapada);
  const [vez, setVez] = useState(0);
  const [saliendo, setSaliendo] = useState(false);
  if (antes !== atrapada) {
    setAntes(atrapada);
    setSaliendo(!atrapada);
    if (atrapada) setVez((n) => n + 1);
  }
  useEffect(() => {
    if (!saliendo) return undefined;
    const espera = setTimeout(() => setSaliendo(false), SALIDA_MS);
    return () => clearTimeout(espera);
  }, [saliendo]);

  return (
    <section className={`mitad ${lado}`} data-modo={modo} style={coloresDe(equipo.color)} aria-label={equipo.nombre}>
      {(atrapada || saliendo) && (
        <div key={vez} className={atrapada ? 'efecto' : 'efecto saliendo'}>
          {/* El cartel («¡Congelada!»…) cae solo al final; durante el duelo basta con el efecto. */}
          <Efecto tipo={efecto} cartel={atrapada && final ? estado.cartelPierde : ''} />
        </div>
      )}
      {modo === 'gana' && <Victoria cartel={estado.cartelGana} />}
    </section>
  );
}


// -----------------------------------------------------------------------------
// 3. Cuadrante de la barra
// -----------------------------------------------------------------------------

function Cuadrante({ equipo: e, ancho, porcentaje, gana }: { equipo: EquipoActivacion; ancho: number; porcentaje: string; gana: boolean }) {
  return (
    <div className={gana ? 'cuadrante gana' : 'cuadrante'} style={{ ...coloresDe(e.color), width: `${ancho}%` }}>
      <img className="regalo" alt="" src={e.imagen || undefined} hidden={!e.imagen} />
      <span className="porcentaje">{porcentaje}</span>
    </div>
  );
}


// -----------------------------------------------------------------------------
// 4. Ficha de un equipo (izquierda o derecha, en espejo)
// -----------------------------------------------------------------------------

interface PropsFicha {
  equipo: EquipoActivacion;
  indice: number;
  lado: (typeof LADOS)[number];
  estado: EstadoDuelo;
  motor: MotorDuelo;
  gana: boolean;
}

function Ficha({ equipo: e, indice: i, lado, estado, motor, gana }: PropsFicha) {
  const nodo = useRef<HTMLDivElement>(null);
  const golpe = useReiniciarAnimacion(nodo, 'golpe', estado.golpes[i] ?? 0);
  const mostrado = useCifraAnimada(estado.puntos[i] ?? 0, { ms: CONTEO_MS, animar: estado.animarCifras, pintada: estado.pintadas });
  const mejor = estado.mejores[i];
  const clases = ['ficha', 'cristal', lado, gana && 'gana', golpe && 'golpe'].filter(Boolean).join(' ');

  return (
    <div className={clases} style={coloresDe(e.color)} ref={nodo}>
      <div className="icono">
        <img className="regalo" alt="" src={e.imagen || undefined} hidden={!e.imagen} />
        <span className="inicial" aria-hidden="true">{e.imagen ? '' : e.nombre.charAt(0).toUpperCase()}</span>
      </div>
      <div className="datos">
        <div className="nombre">{e.nombre}</div>
        <div className="monedas">{formato.format(mostrado)}</div>
        <div className="detalle">
          <span className="miembros">{`👥 ${estado.miembros[i] ?? 0}`}</span>
          {mejor ? <span className="mejor">{`⭐ ${mejor}`}</span> : null}
        </div>
      </div>
      {estado.sumas.filter((s) => s.equipo === i).map((s) => (
        <span key={s.id} className="suma" onAnimationEnd={() => motor.quitarSuma(s.id)}>{`+${formato.format(s.suma)}`}</span>
      ))}
    </div>
  );
}
