// =============================================================================
// widgets/jefe/Mascota.tsx — Modo «Mascota del LIVE» del Jefe (escena y dibujo)
//
// La mascota (SVG propio: una bolita con orejas, alitas y patitas, del color elegido) arriba y,
// debajo, una placa con su nombre, su nivel, la barra hacia el siguiente y lo último que pasó.
// Qué cara pone lo decide el CSS (mascota.css) con data-animo (normal · feliz · comiendo ·
// dormida) y qué adornos lleva, con data-nivel (2 brote · 3 moño · 4 capa · 5 corona). Con cada
// nivel se ve más grande. Los corazones (likes) y la celebración de un nivel nuevo se reinician
// con useReiniciarAnimacion. Reglas en motorMascota.ts.
// =============================================================================

import { useRef, useState, type CSSProperties } from 'react';
import { useIntervalo } from '../../hooks/useIntervalo';
import { useReiniciarAnimacion } from '../../hooks/useReiniciarAnimacion';
import { animoDe, nivelDe, NIVEL_MAX, type EstadoMascota } from './motorMascota';
import './mascota.css';

const formato = new Intl.NumberFormat('es-CO');

const TEXTOS_ANIMO = {
  normal: '¡Dale regalos para que crezca!',
  feliz: '¡Le encantan tus likes!',
  comiendo: '¡Ñam, ñam!',
  dormida: 'Se quedó dormida… escribe en el chat para despertarla',
} as const;

// Corazones que suben con los likes y estrellas de la celebración: [x, y, retraso en ms].
const CORAZONES = [[44, 70, 0], [150, 62, 120], [128, 30, 240]] as const;
const ESTRELLAS = [[24, 60], [176, 60], [40, 150], [160, 150], [100, 14], [64, 24], [138, 26]] as const;

export function EscenaMascota({ estado }: { estado: EstadoMascota }) {
  const [ahora, setAhora] = useState(Date.now());
  useIntervalo(() => setAhora(Date.now()), 250);
  const raiz = useRef<HTMLElement>(null);
  useReiniciarAnimacion(raiz, 'corazones', estado.corazones);
  useReiniciarAnimacion(raiz, 'sube-nivel', estado.subidas);

  const n = nivelDe(estado.puntos, estado.porNivel);
  const animo = animoDe(estado, ahora);
  const clases = ['mascota-escena', estado.corazones > 0 && 'corazones', estado.subidas > 0 && 'sube-nivel'].filter(Boolean).join(' ');
  const texto = animo === 'comiendo' && estado.ultimaAccion ? estado.ultimaAccion : TEXTOS_ANIMO[animo];

  return (
    <main className={clases} ref={raiz} data-animo={animo} data-nivel={n.nivel} style={{ '--mascota': estado.color } as CSSProperties}>
      <div className="mascota-caja">
        <DibujoMascota />
        <div className="cartel-nivel" aria-hidden="true">{`¡Nivel ${n.nivel}: ${n.nombre}!`}</div>
      </div>

      <div className="mascota-placa cristal">
        <div className="cabecera">
          <span className="nombre">{estado.nombre}</span>
          <span className="nivel">{`Nivel ${n.nivel} · ${n.nombre}`}</span>
        </div>
        <div className="barra filo-oro">
          <div className={estado.animar ? 'relleno animado' : 'relleno'} style={{ width: `${Math.round(n.progreso * 100)}%` }} />
          <div className="cifra">
            {n.nivel >= NIVEL_MAX ? `¡Nivel máximo! · ${formato.format(Math.round(estado.puntos))} puntos` : `${formato.format(Math.floor(n.lleva))} / ${formato.format(n.necesita)}`}
          </div>
        </div>
        <div className="accion" aria-live="polite">{texto}</div>
      </div>
    </main>
  );
}

/** La mascota (sin texto: las caras y adornos se muestran u ocultan con el CSS). */
function DibujoMascota() {
  return (
    <svg className="mascota-dibujo" viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <radialGradient id="ma-cuerpo" cx="34%" cy="26%" r="75%">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity=".45" />
          <stop offset=".3" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="1" stopColor="#000000" stopOpacity=".28" />
        </radialGradient>
        <linearGradient id="ma-oro" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFF4C2" />
          <stop offset=".5" stopColor="#F2C744" />
          <stop offset="1" stopColor="#B8891F" />
        </linearGradient>
      </defs>

      {/* Estrellas de la celebración (nivel nuevo) */}
      <g className="ma-estrellas">
        {ESTRELLAS.map(([x, y], i) => (
          <path key={i} d={`M${x} ${y - 7}l2 5 5 2-5 2-2 5-2-5-5-2 5-2z`} style={{ '--i': i } as CSSProperties} />
        ))}
      </g>

      <g className="ma-cuerpo-total">
        <ellipse className="ma-sombra" cx="100" cy="188" rx="58" ry="7" />

        {/* Capa (nivel 4+), detrás del cuerpo */}
        <path className="ma-capa ma-n4" d="M58 96c-14 40-12 70-4 88h92c8-18 10-48-4-88-12 8-26 12-42 12s-30-4-42-12z" />

        <g className="ma-salto">
          {/* Patitas, alitas y orejas */}
          <ellipse className="ma-pata" cx="80" cy="180" rx="13" ry="7" />
          <ellipse className="ma-pata" cx="120" cy="180" rx="13" ry="7" />
          {/* La inclinación va en el grupo: el aleteo (CSS) mueve la elipse desde su hombro. */}
          <g transform="rotate(24 40 126)"><ellipse className="ma-ala ma-ala-izq" cx="40" cy="126" rx="12" ry="20" /></g>
          <g transform="rotate(-24 160 126)"><ellipse className="ma-ala ma-ala-der" cx="160" cy="126" rx="12" ry="20" /></g>
          <path className="ma-oreja" d="M60 78 50 34c-1-6 4-9 9-6l32 24z" />
          <path className="ma-oreja" d="M140 78 150 34c1-6-4-9-9-6l-32 24z" />
          <path className="ma-oreja-dentro" d="M62 64 57 40l20 16z" />
          <path className="ma-oreja-dentro" d="M138 64 143 40l-20 16z" />

          {/* Cuerpo, brillo y panza */}
          <path className="ma-cuerpo" d="M100 54c38 0 64 28 64 66 0 36-26 60-64 60s-64-24-64-60c0-38 26-66 64-66z" />
          <path className="ma-volumen" d="M100 54c38 0 64 28 64 66 0 36-26 60-64 60s-64-24-64-60c0-38 26-66 64-66z" />
          <ellipse className="ma-panza" cx="100" cy="146" rx="36" ry="27" />

          {/* Mejillas */}
          <ellipse className="ma-mejilla" cx="68" cy="122" rx="9" ry="5" />
          <ellipse className="ma-mejilla" cx="132" cy="122" rx="9" ry="5" />

          {/* Caras */}
          <g className="ma-cara ma-cara-normal">
            <g className="ma-ojos">
              <ellipse className="ma-ojo" cx="82" cy="104" rx="7.5" ry="9.5" />
              <ellipse className="ma-ojo" cx="118" cy="104" rx="7.5" ry="9.5" />
              <circle className="ma-brillo" cx="85" cy="100" r="2.6" />
              <circle className="ma-brillo" cx="121" cy="100" r="2.6" />
            </g>
            <path className="ma-trazo" d="M93 121q7 6 14 0" />
          </g>
          <g className="ma-cara ma-cara-feliz">
            <path className="ma-trazo grueso" d="M73 107q9-12 18 0M109 107q9-12 18 0" />
            <path className="ma-boca" d="M88 118q12 14 24 0z" />
            <path className="ma-lengua" d="M95 124q5 5 10 0z" />
          </g>
          <g className="ma-cara ma-cara-comiendo">
            <path className="ma-trazo grueso" d="M74 106q8-8 16 0M110 106q8-8 16 0" />
            <ellipse className="ma-boca ma-mordida" cx="100" cy="124" rx="11" ry="9" />
            <g className="ma-migas">
              <circle cx="84" cy="138" r="2.4" />
              <circle cx="118" cy="140" r="2" />
              <circle cx="104" cy="144" r="1.8" />
            </g>
          </g>
          <g className="ma-cara ma-cara-dormida">
            <path className="ma-trazo grueso" d="M74 105q8 6 16 0M110 105q8 6 16 0" />
            <ellipse className="ma-boca" cx="100" cy="123" rx="3.5" ry="2.8" />
          </g>

          {/* Adornos por nivel: brote (2), moño en la oreja (3), corona (5) */}
          <g className="ma-brote ma-n2">
            <path className="ma-tallo" d="M100 56c0-8 1-14 4-20" />
            <path className="ma-hoja" d="M104 38c6-10 18-10 22-4-8 6-16 8-22 4z" />
            <path className="ma-hoja" d="M103 42c-6-8-17-8-20-2 7 5 14 6 20 2z" />
          </g>
          <g className="ma-mono ma-n3">
            <path d="M66 50l-13-8v16zM66 50l13-8v16z" />
            <circle cx="66" cy="50" r="4" />
          </g>
          <g className="ma-corona ma-n5">
            <path d="M72 50l6-22 12 14 10-20 10 20 12-14 6 22z" />
            <circle cx="100" cy="24" r="3.5" />
          </g>
        </g>
      </g>

      {/* Corazones (likes) y zetas (dormida) */}
      <g className="ma-corazones">
        {CORAZONES.map(([x, y, d], i) => (
          <path key={i} d={`M${x} ${y + 6}c-9-6-12-10-12-14a6 6 0 0 1 12-2 6 6 0 0 1 12 2c0 4-3 8-12 14z`} style={{ animationDelay: `${d}ms` }} />
        ))}
      </g>
      <g className="ma-zetas">
        <text x="146" y="70">z</text>
        <text x="160" y="50">z</text>
        <text x="176" y="28">Z</text>
      </g>
    </svg>
  );
}
