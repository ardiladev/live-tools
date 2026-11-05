// =============================================================================
// vistas/batalla/VistaBatalla.tsx — Juegos → Competencias → Batalla de regalos
//
// Configura el widget batalla.html: dos equipos (nombre, regalo, monedas por regalo, color y foto
// opcional), el cronómetro por rondas (Iniciar / Pausar / Nueva ronda), "Reiniciar batalla" y
// "Reiniciar victorias". Las órdenes llegan a OBS al instante (sincronizar.subir).
// (Port de la sección 3 de legado/js/panel/vistas/batalla.js.)
// =============================================================================

import type { Draft } from 'immer';
import type { EventoRegalo } from '../../../tipos/eventos';
import { EditorEstilo } from '../../componentes/EditorEstilo';
import { BotonesReloj, CampoDuracion, ListaRegalos, PanelReloj, useRelojDeRonda } from '../../componentes/piezasJuego';
import { TarjetaWidget, type PruebaWidget } from '../../componentes/TarjetaWidget';
import { Aviso, Campo, Casilla, Nota, Tarjeta, useAviso } from '../../componentes/ui';
import { nombreRegalo, obtener, useAjustesWidget } from '../../estado/almacen';
import { TEXTOS_RELOJ, textoLimpio, type TextosReloj } from '../../piezas';
import { duracionDe, ID, LETRAS, MAX_NOMBRE, POR_DEFECTO, problemas, type AjustesBatalla, type EquipoAjustes } from './config';

const TEXTOS: TextosReloj = {
  ...TEXTOS_RELOJ,
  corre: ['En juego: los regalos suman', 'Iniciar'],
  pausa: ['En pausa: los regalos no suman', 'Reanudar'],
};

type CambiarBatalla = (receta: (a: Draft<AjustesBatalla>) => void) => void;

export function VistaBatalla() {
  const [cfg, cambiarCfg] = useAjustesWidget(ID, POR_DEFECTO);
  const [avisoReinicio, avisarReinicio] = useAviso();
  const duracionS = duracionDe(cfg);
  const reloj = useRelojDeRonda({ id: ID, ajustes: cfg, cambiarAjustes: cambiarCfg, duracionS, textos: TEXTOS });
  const sinReloj = !cfg.conReloj;

  // Prueba: un regalo para un equipo, con su precio configurado.
  const regaloDePrueba = (i: number, cantidad: number) => (nombre: string): EventoRegalo => {
    const e = cfg.equipos[i];
    return {
      tipo: 'regalo', usuario: nombre, giftId: textoLimpio(e?.giftId), nombre: textoLimpio(e?.regalo),
      cantidad, diamantes: Math.max(1, Number(e?.valor) || 1), imagen: '',
    };
  };
  const pruebas: PruebaWidget[] = [
    { texto: 'Regalo al equipo A', evento: regaloDePrueba(0, 1) },
    { texto: 'Regalo al equipo B', evento: regaloDePrueba(1, 1) },
    { texto: 'Combo ×10 al A', evento: regaloDePrueba(0, 10) },
    { texto: 'Combo ×10 al B', evento: regaloDePrueba(1, 10) },
  ];

  /** Puntos en 0 y reloj detenido con la duración completa (las victorias se quedan). */
  function reiniciar(): void {
    reloj.reiniciar();
    avisarReinicio('Batalla reiniciada: los puntos de los dos equipos vuelven a 0 en OBS.');
  }

  /**
   * Victorias en 0. Si la ronda ya terminó, también empieza otra: si no, el widget volvería
   * a darle la victoria de esa ronda al que la ganó.
   */
  function reiniciarVictorias(): void {
    cambiarCfg((a) => { a.rondaVictorias = Date.now(); });
    if (reloj.terminada()) reloj.reiniciar();
    else reloj.aplicar(reloj.actual());
    avisarReinicio('Victorias reiniciadas: los dos equipos vuelven a 0 victorias en OBS.');
  }

  return (
    <>
      <TarjetaWidget
        id={ID}
        titulo="Batalla de regalos"
        archivo="batalla.html"
        forma="horizontal"
        // El reinicio, el reloj y las victorias llegan a la vista previa sin recargarla.
        sinRecargar={['ro', 't', 'rv']}
        personalizar={(
          <>
            <Casilla
              texto="Con cronómetro: los regalos solo cuentan con el reloj en marcha, y cada ronda da una victoria"
              marcada={cfg.conReloj}
              alCambiar={(v) => cambiarCfg((a) => { a.conReloj = v; })}
            />
            <Casilla texto="Sonido cuando cambia quién va ganando" marcada={cfg.sonido} alCambiar={(v) => cambiarCfg((a) => { a.sonido = v; })} />
            <EditorEstilo id={ID} />
          </>
        )}
        pruebas={pruebas}
      />

      <Tarjeta titulo="Batalla" ancha>
        <PanelReloj reloj={reloj} oculto={sinReloj} />
        <div className="fila-acciones separado-arriba">
          <BotonesReloj reloj={reloj} oculto={sinReloj} />
          <button onClick={reiniciar} title="Detiene el reloj y pone los puntos de los dos equipos en 0">Reiniciar batalla</button>
          <button onClick={reiniciarVictorias} title="Pone las victorias y las rachas de los dos equipos en 0" hidden={sinReloj}>Reiniciar victorias</button>
        </div>
        <CampoDuracion
          etiqueta="Duración de cada ronda (segundos):"
          valor={cfg.duracion}
          duracionS={duracionS}
          oculto={sinReloj}
          alCambiar={(v) => cambiarCfg((a) => { a.duracion = v; })}
        />
        <Aviso aviso={avisoReinicio} />
        <div className="aviso error" role="status">{problemas(cfg.equipos).join(' ')}</div>
        <p className="nota" hidden={sinReloj}>
          Iniciar, pausar y reiniciar llegan a OBS en uno o dos segundos. Con el reloj detenido, los regalos no suman.{' '}
          Cuando el reloj llega a 0, el equipo con más monedas gana la ronda: el widget le suma una victoria y, con 2 o más seguidas,{' '}
          muestra su racha (un empate no suma ni corta la racha). «Nueva ronda» pone los puntos en 0 y conserva las victorias.{' '}
          Las victorias se ven solo en OBS: el panel no recibe los puntos.
        </p>
        <p className="nota" hidden={!sinReloj}>
          El reinicio llega a OBS en uno o dos segundos. Si OBS recarga la fuente, los puntos se conservan hasta que reinicies.
        </p>
      </Tarjeta>

      {[0, 1].map((i) => <TarjetaEquipo key={i} i={i} e={cfg.equipos[i] ?? POR_DEFECTO.equipos[0] as EquipoAjustes} cambiarCfg={cambiarCfg} />)}
      <ListaRegalos id="regalos-batalla" />

      <Nota>
        Cada regalo suma monedas × cantidad, y la barra muestra qué parte del total lleva cada equipo. TikTok no siempre manda el precio:{' '}
        entonces vale lo que pongas en «Monedas por regalo». Busca los IDs en el{' '}
        <a href="#/regalos">Buscador de regalos</a>
        . Tamaño recomendado de la fuente en OBS: 1600 × 300, arriba de la escena.
      </Nota>
    </>
  );
}

function TarjetaEquipo({ i, e, cambiarCfg }: { i: number; e: EquipoAjustes; cambiarCfg: CambiarBatalla }) {
  const cambiarEste = (receta: (x: Draft<EquipoAjustes>) => void): void =>
    cambiarCfg((a) => { const x = a.equipos[i]; if (x) receta(x); });

  return (
    <Tarjeta titulo={`Equipo ${LETRAS[i]} (${i ? 'derecha' : 'izquierda'})`}>
      <div className="campos">
        <Campo etiqueta="Nombre:" valor={e.nombre} maxLength={MAX_NOMBRE} alCambiar={(v) => cambiarEste((x) => { x.nombre = v; })} />
        <Campo
          etiqueta="ID del regalo:"
          valor={e.giftId}
          inputMode="numeric"
          placeholder="ID"
          list="regalos-batalla"
          alCambiar={(v) => {
            // Al escribir o elegir un ID del catálogo, se completan su nombre y su precio.
            const giftId = v.trim();
            const delCatalogo = obtener().regalos[giftId];
            cambiarEste((x) => {
              x.giftId = giftId;
              x.regalo = delCatalogo ? nombreRegalo(delCatalogo) : '';
              if (delCatalogo?.diamantes) x.valor = delCatalogo.diamantes;
            });
          }}
        />
        <Campo etiqueta="Monedas por regalo:" tipo="number" valor={e.valor} min={0} step={1} alCambiar={(v) => cambiarEste((x) => { x.valor = v; })} />
        <Campo etiqueta="Color:" tipo="color" valor={e.color} alCambiar={(v) => cambiarEste((x) => { x.color = v; })} />
      </div>
      <p className="nota sin-margen">{e.regalo ? `Regalo: ${e.regalo}` : ''}</p>
      <div className="campos separado-arriba">
        <Campo etiqueta="Foto (URL, opcional):" valor={e.avatar} placeholder="https://…" alCambiar={(v) => cambiarEste((x) => { x.avatar = v.trim(); })} />
      </div>
      <Nota>Sin foto, se muestra la imagen del regalo (si está en el Buscador de regalos) o la inicial del nombre.</Nota>
    </Tarjeta>
  );
}
