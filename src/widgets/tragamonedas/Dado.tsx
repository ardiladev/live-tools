// =============================================================================
// widgets/tragamonedas/Dado.tsx — Modo «Dado del reto» del Tragamonedas (md: 'dado')
//
// Un dado grande de cristal (cubo 3D con CSS) que rueda con el regalo configurado y elige una de
// hasta seis opciones (estilo, canción, dificultad del siguiente baile…). A su lado, la lista de
// opciones con su número; al caer, la que salió se enciende y aparece en grande debajo.
// Mismas reglas del tragamonedas: un tiro por regalo (con tope por combo), los tiros hacen fila,
// «Probar en OBS» (`pr`), ocultar sin tiros (`oc`) y mandar el resultado a la Cola de retos (`rc`).
// Solo caen las caras que tienen texto. Estilos: dado.css.
// =============================================================================

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { mandarReto } from '../../nucleo/juego';
import { esperar, sonar } from '../../nucleo/sonido';
import type { EventoLive } from '../../tipos/eventos';
import type { ConfigTragamonedas } from './config';
import './dado.css';

export const TIRO_MS = 2300;
export const RESULTADO_DADO_MS = 3600;
const PAUSA_MS = 600;
const MAX_EN_FILA = 50;

/** Cómo queda el cubo para mostrar cada cara (1 al frente, 2 derecha, 3 arriba, 4 abajo, 5 izquierda, 6 atrás). */
const GIROS: Record<number, [number, number]> = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] };
/** Los puntos de cada cara en una rejilla de 3 × 3 (posiciones 1 a 9). */
const PUNTOS: Record<number, number[]> = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };

export interface ManejadorDado {
  aplicarConfig(cfg: ConfigTragamonedas): void;
  alEvento(evento: EventoLive): void;
}

interface AjustesDado {
  titulo: string;
  caras: string[];
  regaloId: string;
  textoRegalo: string;
  max: number;
  ocultar: boolean;
  sonido: boolean;
  cola: string;
}

/** Las caras con texto (índices 0 a 5). */
export const carasConTexto = (caras: readonly string[]): number[] => caras.map((t, i) => (t.trim() ? i : -1)).filter((i) => i >= 0);

export function Dado({ manejador }: { manejador: { current: ManejadorDado | null } }) {
  const [ajustes, setAjustes] = useState<AjustesDado>({ titulo: '', caras: [], regaloId: '', textoRegalo: 'un regalo', max: 10, ocultar: false, sonido: true, cola: '' });
  const [aviso, setAviso] = useState('');
  const [enFila, setEnFila] = useState(0);
  const [cara, setCara] = useState(1);              // la que está arriba (1 a 6)
  const [vueltas, setVueltas] = useState(0);        // cada tiro suma vueltas: así la transición rueda
  const [tirando, setTirando] = useState(false);
  const [resultado, setResultado] = useState<number | null>(null);
  const [mostrando, setMostrando] = useState(false);  // el resultado recién salido (luego queda, sin ocultar)
  const fila = useRef<string[]>([]);
  const procesando = useRef(false);
  const ajustesRef = useRef(ajustes);
  ajustesRef.current = ajustes;
  const ordenProbar = useRef<number | null>(null);
  const vivo = useRef(true);
  useEffect(() => () => { vivo.current = false; }, []);

  async function procesar(): Promise<void> {
    if (procesando.current) return;
    procesando.current = true;
    while (fila.current.length && vivo.current) {
      const usuario = fila.current.shift() as string;
      setEnFila(fila.current.length);
      const a = ajustesRef.current;
      const posibles = carasConTexto(a.caras);
      if (!posibles.length) break;
      const elegida = (posibles[Math.floor(Math.random() * posibles.length)] ?? 0) + 1;
      setAviso(usuario === 'Prueba' ? 'Tiro de prueba' : `${usuario} envió ${a.textoRegalo}`);
      setResultado(null);
      setTirando(true);
      setVueltas((v) => v + 2);
      setCara(elegida);
      if (a.sonido) for (let i = 0; i < 6; i++) setTimeout(() => sonar({ frecuencia: 300 + i * 40, duracion: 0.05, volumen: 0.07, onda: 'square', subida: 1 }), i * 300);
      await esperar(TIRO_MS);
      if (!vivo.current) return;
      setTirando(false);
      setResultado(elegida);
      setMostrando(true);
      if (a.sonido) sonar({ frecuencia: 784, duracion: 0.6, subida: 1.5 });
      const texto = a.caras[elegida - 1] ?? '';
      if (a.cola && usuario !== 'Prueba' && texto) void mandarReto(a.cola, { texto: a.titulo ? `${a.titulo}: ${texto}` : texto, usuario, origen: 'Dado del reto' });
      await esperar(RESULTADO_DADO_MS);
      setMostrando(false);
      await esperar(PAUSA_MS);
    }
    setAviso('');
    procesando.current = false;
    setEnFila(fila.current.length);
  }

  function encolar(usuario: string, tiros: number): void {
    for (let i = 0; i < tiros && fila.current.length < MAX_EN_FILA; i++) fila.current.push(usuario);
    setEnFila(fila.current.length);
    void procesar();
  }

  useLayoutEffect(() => {
    manejador.current = {
      aplicarConfig(cfg) {
        const dd = cfg.dd || {};
        const caras = (Array.isArray(dd.i) ? dd.i : []).slice(0, 6).map((t) => String(t ?? '').trim().slice(0, 40));
        while (caras.length < 6) caras.push('');
        setAjustes({
          titulo: String(dd.t ?? '').trim().slice(0, 30),
          caras,
          regaloId: String(cfg.g ?? '').trim(),
          textoRegalo: String(cfg.r || 'un regalo').slice(0, 30),
          max: Math.max(1, Number(cfg.max) || 10),
          ocultar: cfg.oc === 1,
          sonido: cfg.s !== 0,
          cola: String(cfg.rc || ''),
        });
        // «Probar en OBS»: solo cuenta cuando cambia (al abrir la fuente no se repite la última).
        const pr = Number(cfg.pr) || 0;
        if (ordenProbar.current !== null && pr !== ordenProbar.current) encolar('Prueba', 1);
        ordenProbar.current = pr;
      },
      alEvento(evento) {
        const a = ajustesRef.current;
        if (evento.tipo !== 'regalo' || !a.regaloId || String(evento.giftId) !== a.regaloId) return;
        encolar(evento.usuario || 'Alguien', Math.min(a.max, Math.max(1, Number(evento.cantidad) || 1)));
      },
    };
    return () => { manejador.current = null; };
  });

  const [gx, gy] = GIROS[cara] ?? [0, 0];
  const giro = { '--gx': `${gx + vueltas * 360}deg`, '--gy': `${gy + vueltas * 360}deg` } as CSSProperties;
  const oculto = ajustes.ocultar && !tirando && !mostrando && !enFila;

  return (
    <main className={oculto ? 'escena-dado oculta-dado' : 'escena-dado'}>
      <div className="aviso" role="status" aria-live="polite">{aviso}</div>
      <div className="mesa-dado">
        <div className="caja-dado">
          <div className={tirando ? 'dado tirando' : 'dado'} style={giro}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className={`cara-dado cara-${n}`}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((p) => <span key={p} className={PUNTOS[n]?.includes(p) ? 'punto' : 'hueco'} />)}
              </div>
            ))}
          </div>
          <div className="sombra-dado" />
        </div>

        <div className="opciones-dado cristal">
          {ajustes.titulo ? <div className="titulo-dado">{ajustes.titulo}</div> : null}
          <ol>
            {ajustes.caras.map((texto, i) => (texto ? (
              <li key={i} className={resultado === i + 1 ? 'salio' : undefined}>
                <span className="numero-dado">{i + 1}</span>
                <span className="texto-dado">{texto}</span>
              </li>
            ) : null))}
          </ol>
        </div>
      </div>
      <div className={mostrando ? 'resultado-dado recien' : 'resultado-dado'} aria-live="polite">{resultado !== null ? ajustes.caras[resultado - 1] : ''}</div>
      <div className="cola">{enFila ? `+${enFila} en espera` : ''}</div>
    </main>
  );
}
