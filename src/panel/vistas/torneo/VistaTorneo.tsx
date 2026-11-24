// =============================================================================
// vistas/torneo/VistaTorneo.tsx — Juegos → Competencias → Torneo por llaves
//
// Varias bailarinas (de 2 a 8) en un cuadro de eliminación. Cada cruce se juega en el Duelo VS:
// «Jugar este duelo» pone a las dos en el duelo (izquierda y derecha) con una ronda nueva, y desde
// aquí mismo se inicia el reloj. Cuando el duelo termina, el widget del Duelo VS en OBS anota quién
// ganó (anotar_resultado, ver src/nucleo/final.ts) y esta vista la pasa sola al cruce siguiente
// (lee los resultados cada pocos segundos). Si hace falta, la ganadora se puede elegir a mano.
// El widget torneo.html muestra el cuadro. Lógica del cuadro en cuadro.ts.
// Secciones: 1. Vista · 2. Un cruce
// =============================================================================

import { useEffect, useState } from 'react';
import { useIntervalo } from '../../../hooks/useIntervalo';
import { leerResultados, nubeActiva } from '../../../nucleo/nube';
import type { Bailarina } from '../../bailarinas';
import { FotoBailarina, SelectorBailarinas, useBailarinasActivas } from '../../componentes/Bailarinas';
import { EditorEstilo } from '../../componentes/EditorEstilo';
import { BotonesReloj, CampoDuracion, PanelReloj, useRelojDeRonda } from '../../componentes/piezasJuego';
import { TarjetaWidget } from '../../componentes/TarjetaWidget';
import { Aviso, Campo, Nota, Tarjeta, useAviso } from '../../componentes/ui';
import { cambiarWidget, idNubeDe, obtener, useAjustesWidget, usarAlmacen } from '../../estado/almacen';
import { subir } from '../../estado/sincronizar';
import * as duelo from '../duelo/config';
import { ID, POR_DEFECTO } from './config';
import {
  armarCuadro, campeonaDe, MAX_TORNEO, MIN_TORNEO, mezclar, nombreRonda, propagar, type Partido,
} from './cuadro';

const LEER_CADA_MS = 4000;


// -----------------------------------------------------------------------------
// 1. Vista
// -----------------------------------------------------------------------------

export function VistaTorneo() {
  const [cfg, cambiarCfg] = useAjustesWidget(ID, POR_DEFECTO);
  const [cfgDuelo, cambiarDuelo] = useAjustesWidget(duelo.ID, duelo.POR_DEFECTO);
  const reloj = useRelojDeRonda({ id: duelo.ID, ajustes: cfgDuelo, cambiarAjustes: cambiarDuelo, duracionS: duelo.duracionDe(cfgDuelo) });
  const registradas = useBailarinasActivas();
  const idDuelo = usarAlmacen((e) => idNubeDe(e, duelo.ID));
  const [aviso, avisar] = useAviso(7000);
  const [confirmarArmar, setConfirmarArmar] = useState(false);
  const porId = new Map(registradas.map((b) => [b.id, b]));
  const nombre = (id: string): string => porId.get(id)?.nombre || (id ? 'Bailarina' : '');
  const actual = cfg.actual.length === 2 ? { r: cfg.actual[0] ?? 0, p: cfg.actual[1] ?? 0 } : null;
  const partidoActual = actual ? cfg.rondas[actual.r]?.[actual.p] : undefined;
  const campeona = campeonaDe(cfg.rondas);
  const empezado = cfg.rondas.some((r) => r.some((p) => p.ronda > 0 || (p.ganador && p.a && p.b)));

  useEffect(() => { if (!confirmarArmar) return undefined; const t = setTimeout(() => setConfirmarArmar(false), 4000); return () => clearTimeout(t); }, [confirmarArmar]);

  // ---------- Armar el cuadro ----------
  function elegir(id: string, si: boolean): void {
    if (si && cfg.participantes.length >= MAX_TORNEO) {
      avisar(`El torneo es de ${MIN_TORNEO} a ${MAX_TORNEO} bailarinas.`, { error: true });
      return;
    }
    cambiarCfg((a) => { a.participantes = si ? [...a.participantes.filter((x) => x !== id), id] : a.participantes.filter((x) => x !== id); });
  }

  function armar(alAzar: boolean): void {
    const validas = cfg.participantes.filter((id) => porId.has(id));
    if (validas.length < MIN_TORNEO) {
      avisar(`Marca por lo menos ${MIN_TORNEO} bailarinas.`, { error: true });
      return;
    }
    if (empezado && !confirmarArmar) {
      setConfirmarArmar(true);
      avisar('El torneo ya empezó: pulsa otra vez para armar uno nuevo (se pierde el cuadro actual).', { error: true });
      return;
    }
    setConfirmarArmar(false);
    const orden = alAzar ? mezclar(validas) : validas;
    cambiarCfg((a) => { a.participantes = orden; a.rondas = armarCuadro(orden); a.actual = []; });
    avisar(alAzar ? 'Cuadro armado al azar.' : 'Cuadro armado en el orden en que las marcaste.');
  }

  // ---------- Jugar un cruce ----------
  function jugar(r: number, p: number): void {
    const partido = cfg.rondas[r]?.[p];
    if (!partido?.a || !partido.b) return;
    const ronda = Date.now();
    cambiarWidget(duelo.ID, duelo.POR_DEFECTO, (d) => {
      while (d.equipos.length < 2) d.equipos.push({ ...(duelo.POR_DEFECTO.equipos[d.equipos.length] as duelo.EquipoDuelo) });
      if (d.equipos[0]) d.equipos[0].bailarinas = [partido.a];
      if (d.equipos[1]) d.equipos[1].bailarinas = [partido.b];
      d.ronda = ronda;
      d.reloj = { e: 'listo', fin: 0, r: 0 };
    });
    cambiarCfg((a) => {
      const x = a.rondas[r]?.[p];
      if (x) x.ronda = ronda;
      a.actual = [r, p];
    });
    void subir(duelo.ID);
    void subir(ID);
    avisar(`En el Duelo VS: ${nombre(partido.a)} (izquierda) contra ${nombre(partido.b)} (derecha). Inicia el reloj cuando estén listas.`);
  }

  /** Elige (o corrige) la ganadora de un cruce; '' = deshacer. */
  function ganadora(r: number, p: number, id: string): void {
    cambiarCfg((a) => {
      const x = a.rondas[r]?.[p];
      if (!x) return;
      x.ganador = id;
      a.rondas = propagar(a.rondas);
      if (a.actual[0] === r && a.actual[1] === p) a.actual = [];
    });
    void subir(ID);
    if (id) avisar(`¡Ganó ${nombre(id)}! Pasa al cruce siguiente.`);
  }

  // ---------- Resultado automático (lo anota el widget del Duelo VS en OBS) ----------
  useIntervalo(() => {
    if (!actual || !partidoActual || partidoActual.ganador || !partidoActual.ronda || !idDuelo || !nubeActiva()) return;
    leerResultados(idDuelo).then((lista) => {
      const res = lista.find((x) => Number(x.ronda) >= partidoActual.ronda);
      if (!res) return;
      const estado = obtener();
      const t = estado.widgets[ID] as { actual?: number[] } | undefined;
      if (t?.actual?.[0] !== actual.r || t?.actual?.[1] !== actual.p) return; // cambió mientras se leía
      if (res.datos.g === 0) ganadora(actual.r, actual.p, partidoActual.a);
      else if (res.datos.g === 1) ganadora(actual.r, actual.p, partidoActual.b);
      else {
        cambiarCfg((a) => { a.actual = []; });
        avisar('El duelo terminó empatado: vuelve a jugarlo o elige la ganadora a mano.', { error: true });
      }
    }).catch(() => {});
  }, actual ? LEER_CADA_MS : null);

  return (
    <>
      <TarjetaWidget
        id={ID}
        titulo="Torneo por llaves"
        archivo="torneo.html"
        forma="cuadrado"
        campos={<Campo etiqueta="Título:" valor={cfg.titulo} maxLength={40} alCambiar={(v) => cambiarCfg((a) => { a.titulo = v; })} />}
        personalizar={<EditorEstilo id={ID} />}
      />

      <SelectorBailarinas
        columnas={['En el torneo']}
        columnaDe={(id) => (cfg.participantes.includes(id) ? 0 : -1)}
        alElegir={(id, columna) => elegir(id, columna === 0)}
        nota={`Marca de ${MIN_TORNEO} a ${MAX_TORNEO} bailarinas; el orden en que las marcas es el de las cabezas de serie (si no son 2, 4 u 8, las primeras pasan directo la primera ronda).`}
      />
      {!registradas.length ? (
        <Tarjeta titulo="Bailarinas" ancha>
          <Nota>Primero registra a las bailarinas en <a href="#/bailarinas">Bailarinas → Registro</a>: el torneo se arma con ellas.</Nota>
        </Tarjeta>
      ) : null}

      <Tarjeta titulo="Cuadro" ancha>
        <div className="fila-acciones">
          <button className="principal" onClick={() => armar(false)}>{confirmarArmar ? '¿Seguro? Pulsa otra vez' : 'Armar el cuadro'}</button>
          <button onClick={() => armar(true)}>Armar al azar</button>
        </div>
        <Aviso aviso={aviso} />
        {campeona ? <p className="campeona-panel">{`♛ Campeona: ${nombre(campeona)}`}</p> : null}
        <div className="cuadro-panel">
          {cfg.rondas.map((ronda, r) => (
            <div key={r} className="ronda-panel">
              <h3 className="subtitulo">{nombreRonda(ronda.length)}</h3>
              {ronda.map((p, i) => (
                <Cruce
                  key={i}
                  partido={p}
                  porId={porId}
                  enJuego={actual?.r === r && actual.p === i}
                  alJugar={() => jugar(r, i)}
                  alGanar={(id) => ganadora(r, i, id)}
                />
              ))}
            </div>
          ))}
        </div>
        {!cfg.rondas.length ? <Nota>Marca a las participantes arriba y pulsa «Armar el cuadro».</Nota> : null}
      </Tarjeta>

      <Tarjeta titulo={partidoActual ? `Duelo en juego: ${nombre(partidoActual.a)} vs ${nombre(partidoActual.b)}` : 'Duelo VS'} ancha>
        <PanelReloj reloj={reloj} />
        <div className="fila-acciones separado-arriba">
          <BotonesReloj reloj={reloj} />
        </div>
        <CampoDuracion etiqueta="Duración de cada duelo (segundos):" valor={cfgDuelo.duracion} duracionS={duelo.duracionDe(cfgDuelo)} alCambiar={(v) => cambiarDuelo((a) => { a.duracion = v; })} />
        <Nota>
          Es el reloj del <a href="#/duelo">Duelo VS</a> (su widget va en pantalla completa en LIVE Studio). Cuando el duelo termina, la ganadora
          pasa sola al cruce siguiente: el widget del duelo en OBS anota el resultado y esta vista lo lee cada pocos segundos (con el panel
          abierto). Si terminan empatadas, o para corregir, elige la ganadora a mano en el cruce. Pon también el widget del torneo para mostrar
          el cuadro entre duelo y duelo (recomendado 1920 × 1080).
        </Nota>
      </Tarjeta>
    </>
  );
}


// -----------------------------------------------------------------------------
// 2. Un cruce: las dos bailarinas, quién ganó y los botones
// -----------------------------------------------------------------------------

function Cruce({ partido: p, porId, enJuego, alJugar, alGanar }: {
  partido: Partido;
  porId: Map<string, Bailarina>;
  enJuego: boolean;
  alJugar: () => void;
  alGanar: (id: string) => void;
}) {
  const lugar = (id: string, otro: string) => {
    const b = porId.get(id);
    const clase = !p.ganador ? 'lugar-panel' : p.ganador === id ? 'lugar-panel gano' : 'lugar-panel perdio';
    return (
      <div className={clase}>
        {b ? <FotoBailarina b={b} /> : <span className="foto-bailarina vacia" aria-hidden="true">?</span>}
        <span className="nombre-lugar">{b?.nombre || (otro ? 'Pase libre' : 'Por definir')}</span>
        {b && otro && !p.ganador ? <button type="button" className="enlace" onClick={() => alGanar(id)} title="Elegir a mano a la ganadora">Ganó</button> : null}
      </div>
    );
  };
  const listo = Boolean(p.a && p.b);
  return (
    <div className={enJuego ? 'cruce-panel en-juego' : 'cruce-panel'}>
      {lugar(p.a, p.b)}
      {lugar(p.b, p.a)}
      <div className="fila-acciones">
        {listo && !p.ganador ? (
          <button type="button" className={enJuego ? '' : 'principal'} onClick={alJugar}>{enJuego ? 'Volver a poner en el duelo' : 'Jugar este duelo'}</button>
        ) : null}
        {listo && p.ganador ? <button type="button" onClick={() => alGanar('')}>Deshacer</button> : null}
        {enJuego ? <span className="estado-cruce">En juego…</span> : null}
      </div>
    </div>
  );
}
