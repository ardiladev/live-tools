// =============================================================================
// vistas/subathon/VistaSubathon.tsx — Juegos → Retos del público → Subathon · Subathon extensible
//
// Configura subathon.html / extensible.html: tiempo inicial, tope, cuánto suma el chat y (en el
// extensible) la meta. El reloj BASE se maneja aquí (Iniciar / Pausar / +5 min / Reiniciar) y
// llega a OBS al instante; lo que suma el chat lo lleva el widget (el panel no lo ve).
// (Port de la sección 3 de legado/js/panel/vistas/subathon.js.)
// =============================================================================

import { useState } from 'react';
import { useIntervalo } from '../../../hooks/useIntervalo';
import { formatoReloj } from '../../../nucleo/reloj';
import type { RelojRonda } from '../../../tipos/reloj';
import { EditorEstilo } from '../../componentes/EditorEstilo';
import { TarjetaWidget, type PruebaWidget } from '../../componentes/TarjetaWidget';
import { Aviso, Campo, Casilla, Nota, numero, Tarjeta, useAviso } from '../../componentes/ui';
import { useAjustesWidget } from '../../estado/almacen';
import { subir } from '../../estado/sincronizar';
import {
  baseMs, CINCO_MINUTOS_MS, META_MAX, MINUTOS_MAX, MINUTOS_MIN, minutosInicio, minutosTope, monedasMeta,
  POR_DEFECTO, VARIANTES, type IdSubathon,
} from './config';

const TEXTOS = { listo: ['Listo para empezar', 'Iniciar'], corre: ['En marcha', 'Iniciar'], pausa: ['En pausa', 'Reanudar'] } as const;
type EstadoBase = keyof typeof TEXTOS;

/** Segundos → "0:05", "1:30", "1:05:00" (como formatoReloj, sin el 00: inicial). */
const textoTiempo = (s: number): string => formatoReloj(s * 1000).replace(/^00:/, '0:');

export function VistaSubathon({ id }: { id: IdSubathon }) {
  const { titulo: TITULO, archivo, conMeta, tamano, forma } = VARIANTES[id];
  const [cfg, cambiarCfg] = useAjustesWidget(id, POR_DEFECTO[id]);
  const [aviso, avisar] = useAviso();
  const [, setTic] = useState(0);
  useIntervalo(() => setTic((n) => (n + 1) % 1_000_000), 250);

  const inicio = minutosInicio(id, cfg);
  const topeMin = minutosTope(id, cfg);
  const meta = monedasMeta(id, cfg);
  const iniciar = (t: RelojRonda, ahora = Date.now()): RelojRonda => (t.e === 'corre' ? t : { e: 'corre', fin: ahora + baseMs(t, inicio, ahora), r: 0 });
  const pausar = (t: RelojRonda, ahora = Date.now()): RelojRonda => (t.e === 'corre' ? { e: 'pausa', fin: 0, r: baseMs(t, inicio, ahora) } : t);

  /** Guarda y manda a OBS de inmediato (sin la espera habitual). */
  function aplicar({ reloj, extra = 0, nuevaRonda = false }: { reloj?: RelojRonda; extra?: number; nuevaRonda?: boolean }): void {
    cambiarCfg((a) => {
      if (reloj) a.reloj = { e: reloj.e, fin: reloj.fin, r: reloj.r };
      if (nuevaRonda) {
        a.ronda = Date.now();
        a.extraPanel = 0;
      }
      a.extraPanel = (Number(a.extraPanel) || 0) + extra;
    });
    void subir(id);
  }

  const estado: EstadoBase = cfg.reloj.e === 'corre' || cfg.reloj.e === 'pausa' ? cfg.reloj.e : 'listo';
  const base = baseMs(cfg.reloj, inicio) + (Number(cfg.extraPanel) || 0);
  const porMoneda = Math.max(0, Number(cfg.segPorMoneda) || 0);
  const porLikes = Math.max(0, Number(cfg.segPorLikes) || 0);

  const pruebas: PruebaWidget[] = [
    { texto: '+100 likes', evento: (n) => ({ tipo: 'like', usuario: n, cantidad: 100, total: 0, propios: 100 }) },
    { texto: 'Rosa (1 moneda)', evento: (n) => ({ tipo: 'regalo', usuario: n, giftId: '5655', nombre: 'Rose', cantidad: 1, diamantes: 1, imagen: '' }) },
    { texto: 'Regalo de 30', evento: (n) => ({ tipo: 'regalo', usuario: n, giftId: '5780', nombre: 'Bouquet Flower', cantidad: 1, diamantes: 30, imagen: '' }) },
    { texto: conMeta ? 'Regalo de 500' : 'Regalo de 1.000', evento: (n) => ({ tipo: 'regalo', usuario: n, giftId: '0', nombre: 'Regalo', cantidad: 1, diamantes: conMeta ? 500 : 1000, imagen: '' }) },
  ];

  return (
    <>
      <TarjetaWidget
        id={id}
        titulo={TITULO}
        archivo={archivo}
        forma={forma}
        // El reloj, la ronda y "+5 min" cambian sin reiniciar la vista previa.
        sinRecargar={['t', 'ro', 'ex']}
        campos={(
          <>
            <Campo etiqueta="Título:" valor={cfg.titulo} maxLength={30} alCambiar={(v) => cambiarCfg((a) => { a.titulo = v; })} />
            <Campo etiqueta="Tiempo inicial (minutos):" tipo="number" valor={cfg.minutos} min={MINUTOS_MIN} max={MINUTOS_MAX} step={5} alCambiar={(v) => cambiarCfg((a) => { a.minutos = v; })} />
            <Campo etiqueta="Tope (minutos):" tipo="number" valor={cfg.tope} min={MINUTOS_MIN} max={MINUTOS_MAX} step={30} alCambiar={(v) => cambiarCfg((a) => { a.tope = v; })} />
          </>
        )}
        personalizar={(
          <>
            <Casilla texto="Sonidos (regalos que suman tiempo y final)" marcada={cfg.sonido} alCambiar={(v) => cambiarCfg((a) => { a.sonido = v; })} />
            <EditorEstilo id={id} />
          </>
        )}
        pruebas={pruebas}
      />

      <Tarjeta titulo="Reloj" ancha>
        <div className="reloj-panel">
          <div className="reloj-tiempo" role="timer" data-estado={estado}>{formatoReloj(Math.min(topeMin * 60000, Math.max(0, base)))}</div>
          <div className="reloj-estado">{`${TEXTOS[estado][0]} · sin contar lo que sume el chat`}</div>
        </div>
        <div className="fila-acciones separado-arriba">
          <button className="principal" disabled={estado === 'corre'} onClick={() => aplicar({ reloj: iniciar(cfg.reloj) })}>{TEXTOS[estado][1]}</button>
          <button disabled={estado !== 'corre'} onClick={() => aplicar({ reloj: pausar(cfg.reloj) })}>Pausar</button>
          <button onClick={() => { aplicar({ extra: CINCO_MINUTOS_MS }); avisar('+5 min enviados a OBS (sin pasar del tope).'); }}>+5 min</button>
          <button
            onClick={() => aplicar({ reloj: { e: 'listo', fin: 0, r: 0 }, nuevaRonda: true })}
            title={conMeta
              ? 'Detiene el reloj, vuelve al tiempo inicial, borra todo lo sumado y pone la meta en 0'
              : 'Detiene el reloj, vuelve al tiempo inicial y borra todo lo sumado'}
          >
            Reiniciar
          </button>
        </div>
        <Aviso aviso={aviso} />
        <Nota>
          Los botones llegan a OBS en uno o dos segundos. Reiniciar vuelve al tiempo inicial y borra todo lo sumado.{' '}
          El tiempo que suma el chat lo lleva el widget en OBS: el reloj de aquí no lo incluye, así que el de OBS siempre{' '}
          marca igual o más. El chat suma tiempo con el reloj en marcha o en pausa, nunca antes de iniciar ni después de terminar.
        </Nota>
      </Tarjeta>

      {conMeta ? (
        <Tarjeta titulo="Meta para extender el tiempo" ancha>
          <div className="campos">
            <Campo etiqueta="Monedas de la meta:" tipo="number" valor={cfg.meta ?? ''} min={1} max={META_MAX} step={100} alCambiar={(v) => cambiarCfg((a) => { a.meta = v; })} />
          </div>
          <p className="nota">
            {`Hasta juntar ${numero(meta)} monedas en regalos, nada suma tiempo (ni regalos ni taps). `
              + `Ejemplo: si con ${numero(meta - 1)} monedas llega un regalo de 100, la meta se cumple y suman las `
              + `99 monedas que sobran: ${textoTiempo(99 * porMoneda)}.`}
          </p>
          <Nota>
            La meta solo cuenta monedas de regalos enviados con el reloj en marcha o en pausa. El avance lo lleva el widget en OBS{' '}
            (se ve en su barra; el panel no lo recibe) y se conserva si OBS recarga la fuente. Reiniciar pone la meta en 0.{' '}
            Si bajas la meta por debajo de lo que ya juntaron, se cumple con el siguiente regalo.
          </Nota>
        </Tarjeta>
      ) : null}

      <Tarjeta titulo={conMeta ? 'Tiempo que suma el chat (después de la meta)' : 'Tiempo que suma el chat'} ancha>
        <div className="campos">
          <Campo etiqueta="Segundos por cada 100 likes:" tipo="number" valor={cfg.segPorLikes} min={0} step={1} alCambiar={(v) => cambiarCfg((a) => { a.segPorLikes = v; })} />
          <Campo etiqueta="Segundos por moneda de regalo:" tipo="number" valor={cfg.segPorMoneda} min={0} step={1} alCambiar={(v) => cambiarCfg((a) => { a.segPorMoneda = v; })} />
          <Campo etiqueta="Monedas de un regalo sin precio:" tipo="number" valor={cfg.valorRegalo} min={0} step={1} alCambiar={(v) => cambiarCfg((a) => { a.valorRegalo = v; })} />
        </div>
        <p className="nota">
          {`Una rosa (1 moneda) suma ${textoTiempo(porMoneda)}; un regalo de 100 monedas, ${textoTiempo(porMoneda * 100)}; `
            + `1.000 likes, ${textoTiempo(porLikes * 10)}. El reloj nunca pasa de ${formatoReloj(topeMin * 60000)}.`}
        </p>
        <Nota>
          Cada regalo suma (precio × cantidad) × «segundos por moneda». TikTok casi nunca manda el precio del regalo:{' '}
          entonces cuenta como «monedas de un regalo sin precio».
        </Nota>
      </Tarjeta>

      <Nota>{`Tamaño recomendado de la fuente en OBS: ${tamano}. Lo sumado se conserva si OBS recarga la fuente.`}</Nota>
    </>
  );
}
