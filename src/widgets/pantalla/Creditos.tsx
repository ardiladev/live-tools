// =============================================================================
// widgets/pantalla/Creditos.tsx — Modo «créditos finales» de "Bailarinas en pantalla"
//
// Como al final de una película: el título, y luego cada bailarina (su foto y su nombre en su
// color) con los nombres de quienes la apoyaron en el LIVE, de mayor a menor; al final, el
// texto de despedida. Todo sube de abajo hacia arriba a la velocidad elegida. En bucle, al
// terminar vuelve a empezar (con los datos al día); si no, se detiene con la despedida en el
// centro. «Volver a pasar» del panel (`ro`) los empieza otra vez.
// Los datos se congelan al empezar cada pasada (si cambiaran a mitad, el texto daría saltos).
// Estilos: pantalla.css (sección 3).
// =============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { Fotos } from '../../componentes/Fotos';
import type { LiveEnPantalla } from '../../nucleo/nube';
import type { AjustesPantallaWidget } from './config';
import { armarCreditos } from './motor';
import { coloresBailarina } from './Tarjetas';

/** Velocidad: qué parte del alto de la pantalla sube cada segundo (1 lenta · 2 normal · 3 rápida). */
const VELOCIDADES = [0, 0.05, 0.08, 0.12] as const;
const PAUSA_ENTRE_PASADAS_MS = 1500;
/** Con más nombres que estos, la lista va en varias columnas (si no, sería eterna). */
const NOMBRES_EN_UNA_COLUMNA = 12;
const formato = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

export function Creditos({ cfg, live }: { cfg: AjustesPantallaWidget; live: LiveEnPantalla }) {
  const [pasada, setPasada] = useState(0);
  const [congelado, setCongelado] = useState(live);
  const ultimo = useRef(live);
  ultimo.current = live;
  const rollo = useRef<HTMLDivElement>(null);
  const despedida = useRef<HTMLDivElement>(null);

  // Cada pasada (y cada «Volver a pasar») toma los datos más recientes.
  useEffect(() => { setCongelado(ultimo.current); }, [pasada, cfg.ronda]);

  // Si llega otro LIVE (o los datos de verdad en vez de los de ejemplo), o los primeros apoyos
  // cuando no había nada, se empieza de nuevo con ellos.
  const hayAhora = armarCreditos(cfg, live).length > 0;
  const grupos = useMemo(() => armarCreditos(cfg, congelado), [cfg, congelado]);
  const reempezar = live.sesion !== congelado.sesion || (hayAhora && !grupos.length);
  useEffect(() => {
    if (reempezar) setPasada((p) => p + 1);
  }, [reempezar]);

  // El desplazamiento (sin React en cada cuadro: se mueve el rollo directamente).
  useEffect(() => {
    const nodo = rollo.current;
    if (!nodo) return undefined;
    const velocidad = VELOCIDADES[cfg.velocidad] ?? VELOCIDADES[2];
    let cuadro = 0;
    let siguiente: ReturnType<typeof setTimeout> | undefined;
    const inicio = performance.now();
    const mover = (ahora: number): void => {
      const alto = window.innerHeight;
      let y = alto - velocidad * alto * ((ahora - inicio) / 1000);
      const fin = despedida.current;
      if (!cfg.bucle && fin) {
        // Se detiene con la despedida en el centro de la pantalla.
        const parada = alto / 2 - (fin.offsetTop + fin.offsetHeight / 2);
        if (y <= parada) {
          nodo.style.transform = `translateY(${parada}px)`;
          return;
        }
      }
      if (cfg.bucle && y < -nodo.offsetHeight) {
        y = -nodo.offsetHeight;
        nodo.style.transform = `translateY(${y}px)`;
        siguiente = setTimeout(() => setPasada((p) => p + 1), PAUSA_ENTRE_PASADAS_MS);
        return;
      }
      nodo.style.transform = `translateY(${y}px)`;
      cuadro = requestAnimationFrame(mover);
    };
    nodo.style.transform = `translateY(${window.innerHeight}px)`;
    cuadro = requestAnimationFrame(mover);
    return () => {
      cancelAnimationFrame(cuadro);
      clearTimeout(siguiente);
    };
  }, [pasada, cfg.ronda, cfg.velocidad, cfg.bucle]);

  return (
    <main className="pantalla-creditos">
      <div ref={rollo} className="rollo">
        {cfg.titulo ? <h1 className="titulo-creditos">{cfg.titulo}</h1> : null}
        {grupos.map((g) => (
          <section key={g.bailarina.id} className="grupo-creditos" style={coloresBailarina(g.bailarina.color)}>
            <span className="circulo con-fotos">
              <span className="inicial">{g.bailarina.nombre.charAt(0).toUpperCase()}</span>
              <Fotos ids={g.bailarina.fotos} />
            </span>
            <h2>{g.bailarina.nombre}</h2>
            <p className="apoyaron">{g.personas.length === 1 ? 'La apoyó' : 'La apoyaron'}</p>
            <ol className={g.personas.length > NOMBRES_EN_UNA_COLUMNA ? 'nombres muchos' : 'nombres'}>
              {g.personas.map(([apodo, m], i) => (
                <li key={`${i}-${apodo}`}>
                  <span className="apodo">{apodo}</span>
                  {cfg.monedasFans ? <span className="monedas-fan">{formato.format(m)}</span> : null}
                </li>
              ))}
            </ol>
          </section>
        ))}
        {!grupos.length ? <p className="sin-creditos">Todavía no hay apoyos anotados en este LIVE.</p> : null}
        <div ref={despedida} className="despedida">{cfg.final}</div>
      </div>
    </main>
  );
}
