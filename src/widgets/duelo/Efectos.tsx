// =============================================================================
// widgets/duelo/Efectos.tsx — Lo que cae sobre la mitad de la pantalla de quien va perdiendo el
// duelo (durante todo el duelo y al final, con su cartel) y la luz sobre la de quien gana. Todo es SVG y CSS propio (efectos.css), sin imágenes:
//   Celda     → los barrotes bajan de golpe, se cierran los travesaños y cae un candado
//   Invierno  → la escarcha crece desde los bordes, cuelgan carámbanos, nieva y queda un bloque de hielo
//   Telaraña  → se tejen telarañas en las esquinas y en el centro, y baja una araña por su hilo
//   Tormenta  → llega una nube negra, llueve, caen rayos y se forma un charco
// Cada pieza al azar (copos, gotas, ramas) sale de una semilla fija: se ve igual en cada recarga.
// El texto del cartel es lo único que entra al DOM como texto; lo demás es decorativo (aria-hidden).
// Secciones: 1. Utilidades · 2. Celda · 3. Invierno · 4. Telaraña · 5. Tormenta · 6. Victoria
//            7. Efecto (elige cuál) y sonidos
// =============================================================================

import type { CSSProperties, ReactNode } from 'react';
import { sonar } from '../../nucleo/sonido';
import type { Efecto as TipoEfecto } from './config';


// -----------------------------------------------------------------------------
// 1. Utilidades
// -----------------------------------------------------------------------------

/** Números «al azar» que salen siempre iguales para la misma semilla (mulberry32). */
function azar(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lista = (n: number): number[] => Array.from({ length: n }, (_, i) => i);
const r1 = (n: number): string => n.toFixed(1);
/** Variables CSS en línea (React no tipa las propiedades personalizadas). */
const vars = (v: Record<string, string | number>): CSSProperties => v as CSSProperties;

/** Cartel grande con el texto del final (el único texto del efecto). Sin texto, no hay cartel. */
function Cartel({ texto, clase }: { texto: string; clase: string }) {
  if (!texto) return null;
  return <div className={`cartel ${clase}`}><span>{texto}</span></div>;
}

/** Un SVG que se dibuja trazo a trazo (stroke-dasharray con pathLength 1, ver efectos.css). */
function Trazo({ d, clase, estilo }: { d: string; clase: string; estilo?: CSSProperties }) {
  return (
    <svg className={clase} style={estilo} viewBox="0 0 100 100" aria-hidden="true">
      <path d={d} pathLength={1} />
    </svg>
  );
}


// -----------------------------------------------------------------------------
// 2. Celda
// -----------------------------------------------------------------------------

const BARROTES = 6;

function Celda({ cartel }: { cartel: string }) {
  return (
    <div className="ef ef-celda">
      <div className="ef-velo" />
      <div className="celda-reja" aria-hidden="true">
        <div className="celda-barrotes">
          {lista(BARROTES).map((i) => <span key={i} className="barrote" style={vars({ '--i': i })} />)}
        </div>
        <span className="travesano arriba" />
        <span className="travesano medio" />
        <span className="travesano abajo" />
        <svg className="candado" viewBox="0 0 100 130">
          <defs>
            <linearGradient id="candado-cuerpo" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#F6E7A8" />
              <stop offset=".45" stopColor="#C9A23A" />
              <stop offset="1" stopColor="#6E5214" />
            </linearGradient>
            <linearGradient id="candado-arco" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#5b5f66" />
              <stop offset=".45" stopColor="#e9ecf0" />
              <stop offset="1" stopColor="#4a4e55" />
            </linearGradient>
          </defs>
          <path d="M28 62 V40 a22 22 0 0 1 44 0 V62" fill="none" stroke="url(#candado-arco)" strokeWidth="11" strokeLinecap="round" />
          <rect x="12" y="58" width="76" height="66" rx="10" fill="url(#candado-cuerpo)" stroke="#4d3a0e" strokeWidth="3" />
          <rect x="18" y="64" width="64" height="8" rx="4" fill="rgba(255,255,255,.35)" />
          <circle cx="50" cy="88" r="8" fill="#2a1f08" />
          <path d="M46 92 L44 110 H56 L54 92 Z" fill="#2a1f08" />
        </svg>
      </div>
      <Cartel texto={cartel} clase="cartel-celda" />
    </div>
  );
}


// -----------------------------------------------------------------------------
// 3. Invierno
// -----------------------------------------------------------------------------

/** Una rama de escarcha (helecho de hielo) que crece de izquierda a derecha en una caja de 100. */
function caminoRama(semilla: number): string {
  const r = azar(semilla);
  let d = 'M0 50 L100 50';
  for (let x = 8 + r() * 4; x < 90; x += 8 + r() * 6) {
    const largo = (100 - x) * (0.28 + r() * 0.2);
    const angulo = 0.75 + r() * 0.3;
    for (const lado of [-1, 1]) {
      const x2 = x + Math.cos(angulo) * largo;
      const y2 = 50 + lado * Math.sin(angulo) * largo;
      d += ` M${r1(x)} 50 L${r1(x2)} ${r1(y2)}`;
      // Ramitas que salen de cada rama hacia afuera.
      for (const t of [0.4, 0.7]) {
        const bx = x + (x2 - x) * t;
        const by = 50 + (y2 - 50) * t;
        const l2 = largo * (1 - t) * 0.7;
        d += ` M${r1(bx)} ${r1(by)} L${r1(bx + l2 * 0.8)} ${r1(by + lado * l2 * 0.35)}`;
      }
    }
  }
  return d;
}

/** Dónde nace cada rama: posición (%), giro (grados) y tamaño (en --u). */
const RAMAS: { x: number; y: number; giro: number; tam: number }[] = [
  { x: 0, y: 30, giro: 15, tam: 38 }, { x: 0, y: 72, giro: -20, tam: 42 },
  { x: 100, y: 22, giro: 165, tam: 34 }, { x: 100, y: 60, giro: 195, tam: 44 },
  { x: 0, y: 100, giro: -45, tam: 46 }, { x: 100, y: 100, giro: 225, tam: 46 },
  { x: 30, y: 100, giro: -80, tam: 30 }, { x: 72, y: 100, giro: -100, tam: 32 },
];

/** Carámbanos colgando del borde de arriba (caja 100 × 30, se estira a lo ancho). */
function caminoCarambanos(): string {
  const r = azar(77);
  let d = 'M0 0';
  for (let x = 0; x < 100;) {
    const ancho = 3 + r() * 5;
    const largo = 6 + r() * 22;
    d += ` L${r1(x + ancho / 2)} ${r1(largo)} L${r1(Math.min(100, x + ancho))} 0`;
    x += ancho;
  }
  return `${d} Z`;
}

const CARAMBANOS = caminoCarambanos();
const COPOS = (() => {
  const r = azar(9);
  return lista(28).map((i) => ({
    i, x: r() * 100, tam: 0.5 + r() * 1.3, dura: 5 + r() * 6, espera: -r() * 10, vaiven: (r() - 0.5) * 8,
  }));
})();

/** Copo de nieve de seis puntas. */
function Copo() {
  return (
    <svg viewBox="-10 -10 20 20" aria-hidden="true">
      {[0, 60, 120].map((g) => (
        <g key={g} transform={`rotate(${g})`}>
          <path d="M0 -9 V9 M-2.5 -6 L0 -4 L2.5 -6 M-2.5 6 L0 4 L2.5 6" />
        </g>
      ))}
    </svg>
  );
}

function Invierno({ cartel }: { cartel: string }) {
  return (
    <div className="ef ef-hielo">
      <div className="ef-velo" />
      <div className="hielo-escarcha" />
      <div aria-hidden="true">
        {RAMAS.map((rama, i) => (
          <Trazo
            key={i}
            d={caminoRama(i + 1)}
            clase="hielo-rama"
            estilo={vars({ left: `${rama.x}%`, top: `${rama.y}%`, '--giro': `${rama.giro}deg`, '--tam': rama.tam, '--i': i })}
          />
        ))}
        <svg className="hielo-carambanos" viewBox="0 0 100 30" preserveAspectRatio="none">
          <defs>
            <linearGradient id="carambano" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="rgba(240,250,255,.95)" />
              <stop offset="1" stopColor="rgba(150,210,245,.35)" />
            </linearGradient>
          </defs>
          <path d={CARAMBANOS} fill="url(#carambano)" />
        </svg>
        <div className="hielo-bloque" />
        <div className="hielo-brillo" />
        {COPOS.map((c) => (
          <span
            key={c.i}
            className="copo"
            style={vars({ left: `${c.x}%`, '--tam': c.tam, '--dura': `${c.dura}s`, '--espera': `${c.espera}s`, '--vaiven': c.vaiven })}
          >
            <Copo />
          </span>
        ))}
      </div>
      <Cartel texto={cartel} clase="cartel-hielo" />
    </div>
  );
}


// -----------------------------------------------------------------------------
// 4. Telaraña
// -----------------------------------------------------------------------------

/**
 * Una telaraña en una caja de 100: radios desde el centro (cx, cy) entre los ángulos `desde` y
 * `hasta` (grados) y anillos que cuelgan un poco entre radio y radio.
 */
function caminoTelarana({ cx, cy, radio, desde, hasta, radios, anillos, semilla }: {
  cx: number; cy: number; radio: number; desde: number; hasta: number; radios: number; anillos: number; semilla: number;
}): string {
  const r = azar(semilla);
  const completa = hasta - desde >= 360;
  const paso = (hasta - desde) / (completa ? radios : radios - 1);
  const angulos = lista(radios).map((i) => ((desde + i * paso + (r() - 0.5) * paso * 0.3) * Math.PI) / 180);
  const punto = (a: number, d: number): [number, number] => [cx + Math.cos(a) * d, cy + Math.sin(a) * d];
  let d = '';
  for (const a of angulos) {
    const [x, y] = punto(a, radio);
    d += ` M${r1(cx)} ${r1(cy)} L${r1(x)} ${r1(y)}`;
  }
  for (let k = 1; k <= anillos; k++) {
    const dist = (radio * k) / (anillos + 0.4);
    const vueltas = completa ? angulos.length : angulos.length - 1;
    const [x0, y0] = punto(angulos[0] ?? 0, dist);
    d += ` M${r1(x0)} ${r1(y0)}`;
    for (let j = 1; j <= vueltas; j++) {
      const a1 = angulos[(j - 1) % angulos.length] ?? 0;
      const a2 = angulos[j % angulos.length] ?? 0;
      const medio = completa && j === vueltas ? a1 + (a2 + 2 * Math.PI - a1) / 2 : (a1 + a2) / 2;
      const [qx, qy] = punto(medio, dist * 0.82); // el hilo cuelga hacia el centro
      const [x2, y2] = punto(a2, dist);
      d += ` Q${r1(qx)} ${r1(qy)} ${r1(x2)} ${r1(y2)}`;
    }
  }
  return d.trim();
}

const TELA_ESQUINA = caminoTelarana({ cx: 0, cy: 0, radio: 100, desde: 0, hasta: 90, radios: 7, anillos: 8, semilla: 3 });
const TELA_CENTRO = caminoTelarana({ cx: 50, cy: 50, radio: 49, desde: 0, hasta: 360, radios: 14, anillos: 10, semilla: 5 });
/** Hilos sueltos que cruzan la mitad (caja 100 × 100 estirada). */
const HILOS = 'M0 18 L100 64 M100 10 L0 82 M8 100 L92 0 M0 46 L100 38';

function Arana() {
  return (
    <svg className="arana" viewBox="-30 -30 60 60" aria-hidden="true">
      <g className="patas" fill="none" stroke="#151218" strokeWidth="2.6" strokeLinecap="round">
        {[-1, 1].map((lado) => [0, 1, 2, 3].map((k) => (
          <path
            key={`${lado}-${k}`}
            className={`pata pata-${k}`}
            d={`M0 ${-4 + k * 3} Q${lado * 16} ${-14 + k * 7} ${lado * 26} ${-6 + k * 9}`}
          />
        )))}
      </g>
      <ellipse cx="0" cy="8" rx="10" ry="12" fill="#1d1922" />
      <ellipse cx="0" cy="-6" rx="7" ry="6" fill="#26212c" />
      <path d="M-4 6 L0 12 L4 6 L0 16 Z" fill="#B3263A" />
      <circle cx="-2.6" cy="-8" r="1.6" fill="#FF4D5E" />
      <circle cx="2.6" cy="-8" r="1.6" fill="#FF4D5E" />
    </svg>
  );
}

function Telarana({ cartel }: { cartel: string }) {
  return (
    <div className="ef ef-telarana">
      <div className="ef-velo" />
      <div aria-hidden="true">
        {['arriba-izq', 'arriba-der', 'abajo-der', 'abajo-izq'].map((esquina, i) => (
          <Trazo key={esquina} d={TELA_ESQUINA} clase={`tela tela-esquina ${esquina}`} estilo={vars({ '--i': i })} />
        ))}
        <Trazo d={TELA_CENTRO} clase="tela tela-centro" />
        <svg className="tela-hilos" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d={HILOS} pathLength={1} />
        </svg>
        <div className="arana-hilo"><Arana /></div>
      </div>
      <Cartel texto={cartel} clase="cartel-telarana" />
    </div>
  );
}


// -----------------------------------------------------------------------------
// 5. Tormenta
// -----------------------------------------------------------------------------

const GOTAS = (() => {
  const r = azar(21);
  return lista(72).map((i) => ({ i, x: r() * 104 - 2, dura: 0.5 + r() * 0.35, espera: -r() * 2, largo: 3 + r() * 3 }));
})();

/** Bolas de la nube [cx, cy, radio]: arriba esponjosa, abajo casi plana. */
const NUBE: [number, number, number][] = [
  [34, 62, 20], [58, 50, 28], [92, 36, 34], [128, 32, 30], [160, 44, 28], [188, 60, 20],
  [72, 66, 20], [110, 64, 22], [148, 64, 20],
];

function Nube({ clase, id }: { clase: string; id: string }) {
  return (
    <svg className={clase} viewBox="0 0 220 90" aria-hidden="true">
      <defs>
        <radialGradient id={id} cx=".45" cy=".3" r=".8">
          <stop offset="0" stopColor="#6b7285" />
          <stop offset=".6" stopColor="#353a48" />
          <stop offset="1" stopColor="#1b1e27" />
        </radialGradient>
      </defs>
      <g fill={`url(#${id})`}>
        {NUBE.map(([cx, cy, r], i) => <circle key={i} cx={cx} cy={cy} r={r} />)}
        <ellipse cx="110" cy="72" rx="96" ry="15" />
      </g>
    </svg>
  );
}

function Tormenta({ cartel }: { cartel: string }) {
  return (
    <div className="ef ef-tormenta">
      <div className="ef-velo" />
      <div className="tormenta-destello" />
      <div aria-hidden="true">
        <div className="tormenta-lluvia">
          {GOTAS.map((g) => (
            <span key={g.i} className="gota" style={vars({ left: `${g.x}%`, '--dura': `${g.dura}s`, '--espera': `${g.espera}s`, '--largo': g.largo })} />
          ))}
        </div>
        <svg className="rayo" viewBox="0 0 40 120">
          <path d="M24 0 L6 58 H20 L10 120 L36 44 H22 L32 0 Z" />
        </svg>
        <svg className="rayo rayo-2" viewBox="0 0 40 120">
          <path d="M24 0 L6 58 H20 L10 120 L36 44 H22 L32 0 Z" />
        </svg>
        <Nube clase="nube nube-atras" id="nube-atras" />
        <Nube clase="nube nube-frente" id="nube-frente" />
        <div className="charco"><span /><span /><span /></div>
      </div>
      <Cartel texto={cartel} clase="cartel-tormenta" />
    </div>
  );
}


// -----------------------------------------------------------------------------
// 6. Victoria (la mitad de quien gana)
// -----------------------------------------------------------------------------

const DESTELLOS = (() => {
  const r = azar(33);
  return lista(14).map((i) => ({ i, x: 6 + r() * 88, y: 22 + r() * 66, tam: 1.2 + r() * 2.2, espera: r() * 2.4 }));
})();

export function Victoria({ cartel }: { cartel: string }) {
  return (
    <div className="ef ef-victoria">
      <div className="victoria-luz" />
      <div aria-hidden="true">
        {DESTELLOS.map((s) => (
          <svg
            key={s.i}
            className="destello"
            viewBox="-10 -10 20 20"
            style={vars({ left: `${s.x}%`, top: `${s.y}%`, '--tam': s.tam, '--espera': `${s.espera}s` })}
          >
            <path d="M0 -10 Q1.2 -1.2 10 0 Q1.2 1.2 0 10 Q-1.2 1.2 -10 0 Q-1.2 -1.2 0 -10 Z" />
          </svg>
        ))}
      </div>
      <Cartel texto={cartel} clase="cartel-gana" />
    </div>
  );
}


// -----------------------------------------------------------------------------
// 7. Efecto (elige cuál) y sonidos
// -----------------------------------------------------------------------------

const COMPONENTES: Record<TipoEfecto, (p: { cartel: string }) => ReactNode> = {
  celda: Celda,
  hielo: Invierno,
  telarana: Telarana,
  tormenta: Tormenta,
};

export function Efecto({ tipo, cartel }: { tipo: TipoEfecto; cartel: string }) {
  const Componente = COMPONENTES[tipo];
  return <Componente cartel={cartel} />;
}

/** Sonido de cada efecto al caer (sintetizado, como los demás juegos). */
export function sonarEfecto(tipo: TipoEfecto): void {
  const despues = (ms: number, f: () => void): void => { setTimeout(f, ms); };
  if (tipo === 'celda') {
    // Golpe metálico de la reja y el «clic» del candado.
    sonar({ frecuencia: 180, duracion: 0.35, volumen: 0.2, onda: 'square', subida: 0.6 });
    despues(120, () => sonar({ frecuencia: 95, duracion: 0.5, volumen: 0.18, onda: 'sawtooth', subida: 0.7 }));
    despues(900, () => sonar({ frecuencia: 1400, duracion: 0.08, volumen: 0.12, onda: 'square', subida: 1 }));
  } else if (tipo === 'hielo') {
    // Cristales que crujen, de agudo a más agudo.
    [0, 140, 260, 420].forEach((ms, i) => despues(ms, () => sonar({ frecuencia: 1500 + i * 420, duracion: 0.25, volumen: 0.08, onda: 'triangle', subida: 1.6 })));
  } else if (tipo === 'telarana') {
    // Hilo que se estira.
    sonar({ frecuencia: 320, duracion: 0.7, volumen: 0.1, onda: 'triangle', subida: 2.2 });
    despues(500, () => sonar({ frecuencia: 260, duracion: 0.5, volumen: 0.08, onda: 'triangle', subida: 0.7 }));
  } else {
    // Trueno: grave y largo.
    sonar({ frecuencia: 70, duracion: 1.2, volumen: 0.22, onda: 'sawtooth', subida: 0.6 });
    despues(250, () => sonar({ frecuencia: 55, duracion: 1, volumen: 0.18, onda: 'square', subida: 0.8 }));
  }
}
