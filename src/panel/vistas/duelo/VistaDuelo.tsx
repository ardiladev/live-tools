// =============================================================================
// vistas/duelo/VistaDuelo.tsx — Juegos → Competencias → Duelo VS
//
// Configura el widget duelo.html: dos bailarinas (izquierda y derecha) con la barra de activación
// arriba. Durante todo el duelo, la mitad de quien va perdiendo se ve presa del efecto elegido
// (celda, invierno, telaraña, tormenta o uno al azar en cada ronda); al terminar, quien perdió se
// queda así con su cartel. Iniciar/Pausar/Terminar ahora/
// Reiniciar cambian el reloj (`t`) o la ronda (`ro`) y se suben a Supabase al instante.
// Secciones: 1. Pruebas · 2. Vista · 3. Tarjeta de una bailarina
// =============================================================================

import type { Draft } from 'immer';
import type { EventoRegalo } from '../../../tipos/eventos';
import { DATOS_EFECTO, efectoDeRonda, MAX_CARTEL, type EleccionEfecto } from '../../../widgets/duelo/config';
import { EditorEstilo } from '../../componentes/EditorEstilo';
import {
  BotonesReloj, CampoDuracion, ListaRegalos, PanelReloj, useRelojDeRonda,
} from '../../componentes/piezasJuego';
import { TarjetaWidget, type PruebaWidget } from '../../componentes/TarjetaWidget';
import { Aviso, Campo, Casilla, Nota, Segmentado, Tarjeta, useAviso } from '../../componentes/ui';
import { nombreRegalo, obtener, useAjustesWidget } from '../../estado/almacen';
import { textoLimpio, type TextosReloj } from '../../piezas';
import {
  duracionDe, equiposDe, ID, MAX_NOMBRE, POR_DEFECTO, problemas,
  type AjustesDuelo, type EquipoDuelo,
} from './config';

const LISTA_REGALOS = 'regalos-duelo';
const LADOS = ['izquierda', 'derecha'] as const;

const OPCIONES_EFECTO: ReadonlyArray<readonly [EleccionEfecto, string]> = [
  ['azar', '🎲 Al azar'],
  ['celda', '⛓️ Celda'],
  ['hielo', '❄️ Invierno'],
  ['telarana', '🕸️ Telaraña'],
  ['tormenta', '⛈️ Tormenta'],
];

const DESCRIPCION_EFECTO: Record<EleccionEfecto, string> = {
  azar: 'Cada ronda trae un efecto distinto.',
  celda: 'Los barrotes de una celda bajan de golpe sobre su mitad, se cierran los travesaños y cae un candado.',
  hielo: 'La escarcha crece desde los bordes, cuelgan carámbanos, nieva y su mitad queda dentro de un bloque de hielo.',
  telarana: 'Se tejen telarañas en las esquinas y sobre ella, y baja una araña por su hilo.',
  tormenta: 'Llega una nube negra sobre ella: lluvia, rayos y un charco a sus pies.',
};

const TEXTOS: TextosReloj = {
  listo: ['Listo: ya se pueden unir, pero los regalos aún no suman', 'Iniciar'],
  corre: ['En juego: los regalos suman', 'Iniciar'],
  pausa: ['En pausa: los regalos no suman', 'Reanudar'],
  fin: ['Terminó el duelo: quien perdió queda atrapada hasta la próxima ronda', 'Nueva ronda'],
};


// -----------------------------------------------------------------------------
// 1. Pruebas: unirse a un equipo (con su activador) y regalos de quien ya se unió
// -----------------------------------------------------------------------------

const NOMBRES = ['Camila', 'Mateo', 'Sofía', 'Samuel', 'Isabella', 'Tomás', 'Mariana', 'Emiliano'];

const activador = (b: EquipoDuelo | undefined, nombre: string, cantidad = 1): EventoRegalo => ({
  tipo: 'regalo', usuario: nombre, giftId: textoLimpio(b?.giftId), nombre: textoLimpio(b?.regalo),
  cantidad, diamantes: Math.max(1, Number(b?.valor) || 1), imagen: '',
});

const otroRegalo = (cantidad: number, diamantes: number) => (nombre: string): EventoRegalo => ({
  tipo: 'regalo', usuario: nombre, giftId: '0', nombre: 'Regalo', cantidad, diamantes, imagen: '',
});


// -----------------------------------------------------------------------------
// 2. Vista
// -----------------------------------------------------------------------------

export function VistaDuelo() {
  const [cfg, cambiarCfg] = useAjustesWidget(ID, POR_DEFECTO);
  const duracionS = duracionDe(cfg);
  const reloj = useRelojDeRonda({ id: ID, ajustes: cfg, cambiarAjustes: cambiarCfg, duracionS, textos: TEXTOS });
  const [avisoReinicio, avisarReinicio] = useAviso();
  const equipos = equiposDe(cfg);
  const { estado } = reloj.lectura;
  const tocaEstaRonda = DATOS_EFECTO[efectoDeRonda(cfg.efecto, cfg.ronda)].nombre;

  const pruebas: PruebaWidget[] = [
    { texto: `Unirme a ${textoLimpio(equipos[0]?.nombre) || 'Bailarina 1'}`, evento: (nombre) => activador(equipos[0], nombre) },
    { texto: `Unirme a ${textoLimpio(equipos[1]?.nombre) || 'Bailarina 2'}`, evento: (nombre) => activador(equipos[1], nombre) },
    { texto: 'Mi regalo de 25', evento: otroRegalo(1, 25) },
    { texto: 'Mi combo ×10 rosas', evento: otroRegalo(10, 1) },
    {
      texto: 'Otra persona se une',
      evento: () => activador(
        equipos[Math.floor(Math.random() * equipos.length)],
        NOMBRES[Math.floor(Math.random() * NOMBRES.length)] ?? 'Camila',
        5,
      ),
    },
  ];

  /** Termina la ronda ya (como si el reloj llegara a 0): a los 3 s quien pierde se queda atrapada. */
  function terminarAhora(): void {
    reloj.aplicar({ e: 'corre', fin: Date.now(), r: 0 });
  }

  /** Monedas y equipos en 0, reloj detenido con la duración completa y nadie atrapada. */
  function reiniciar(): void {
    reloj.reiniciar();
    avisarReinicio('Duelo reiniciado: las dos vuelven a 0 monedas, quedan libres y el público tiene que volver a unirse.');
  }

  return (
    <>
      <TarjetaWidget
        id={ID}
        titulo="Duelo VS"
        archivo="duelo.html"
        forma="vertical"
        // El reinicio, el reloj, el efecto y los carteles llegan a la vista previa sin recargarla
        // (no se pierden los regalos de prueba).
        sinRecargar={['ro', 't', 'ef', 'am', 'tp', 'tg']}
        personalizar={(
          <>
            <Casilla texto="Sonidos (alguien se une, cambia quién va ganando, final y el efecto al caer)" marcada={cfg.sonido} alCambiar={(v) => cambiarCfg((a) => { a.sonido = v; })} />
            <EditorEstilo id={ID} />
          </>
        )}
        pruebas={pruebas}
      />

      <Tarjeta titulo="Ronda" ancha>
        <PanelReloj reloj={reloj} />
        <div className="fila-acciones separado-arriba">
          <BotonesReloj reloj={reloj} />
          <button onClick={terminarAhora} disabled={estado !== 'corre' && estado !== 'pausa'} title="Pone el reloj en 0: a los 3 segundos quien va perdiendo se queda atrapada con su cartel">
            Terminar ahora
          </button>
          <button onClick={reiniciar} title="Detiene el reloj, pone a las dos en 0, las libera y saca a todos de sus equipos">Reiniciar duelo</button>
        </div>
        <CampoDuracion etiqueta="Duración de cada ronda (segundos):" valor={cfg.duracion} duracionS={duracionS} alCambiar={(v) => cambiarCfg((a) => { a.duracion = v; })} />
        <Aviso aviso={avisoReinicio} />
        <div className="aviso error" role="status">{problemas(cfg).join(' ')}</div>
        <Nota>
          {'Cómo se juega: cada bailarina tiene su regalo activador. Quien lo envía se une a su equipo (ese regalo ya le suma) y, desde ahí, '
            + 'CUALQUIER regalo suyo le suma. Si envía el activador de la otra, se cambia. Los regalos de quien no se ha unido no suman. '
            + 'Arriba, la barra se reparte según las monedas de cada una. Durante todo el duelo, la mitad de la pantalla de quien va '
            + 'perdiendo se ve atrapada (congelada, en la celda, en la telaraña o en la tormenta); si pasa a la otra, se libera y el efecto '
            + 'cae sobre la otra. Al llegar a 0 (o con «Terminar ahora»), se cuentan los últimos regalos durante 3 segundos y quien perdió '
            + 'se queda atrapada con su cartel; la mitad de quien ganó se ilumina. '
            + 'Queda así hasta «Nueva ronda» o «Reiniciar duelo». Si terminan empatadas, nadie queda atrapada.'}
        </Nota>
      </Tarjeta>

      <Tarjeta titulo="Efecto para quien pierde" ancha>
        <Segmentado etiqueta="Qué le cae a su mitad de la pantalla:" opciones={OPCIONES_EFECTO} valor={cfg.efecto} alCambiar={(v) => cambiarCfg((a) => { a.efecto = v; })} />
        <p className="nota">
          {DESCRIPCION_EFECTO[cfg.efecto]}
          {cfg.efecto === 'azar' ? ` En esta ronda tocará: ${tocaEstaRonda}.` : ''}
        </p>
        <Casilla
          texto="Durante todo el duelo, quien va perdiendo ya se ve atrapada (si la pasa, se libera y le cae a la otra). Sin marcar, el efecto cae solo al final."
          marcada={cfg.enVivo}
          alCambiar={(v) => cambiarCfg((a) => { a.enVivo = v; })}
        />
        <div className="campos separado-arriba">
          <Campo
            etiqueta="Cartel de quien pierde:"
            valor={cfg.cartelPierde}
            maxLength={MAX_CARTEL}
            placeholder={cfg.efecto === 'azar' ? 'El del efecto (¡Atrapada!, ¡Congelada!…)' : DATOS_EFECTO[cfg.efecto].cartel}
            alCambiar={(v) => cambiarCfg((a) => { a.cartelPierde = v; })}
          />
          <Campo
            etiqueta="Cartel de quien gana:"
            valor={cfg.cartelGana}
            maxLength={MAX_CARTEL}
            placeholder="¡Ganadora!"
            alCambiar={(v) => cambiarCfg((a) => { a.cartelGana = v; })}
          />
        </div>
      </Tarjeta>

      {equipos.map((b, i) => (
        <TarjetaBailarina key={i} b={b} i={i} cambiarCfg={cambiarCfg} />
      ))}
      <ListaRegalos id={LISTA_REGALOS} />

      <Nota>
        {'En TikTok LIVE Studio (u OBS), pon esta fuente de navegador en PANTALLA COMPLETA (1080 × 1920 en vertical) encima de la cámara, '
          + 'con cada bailarina en su mitad: la 1 a la izquierda y la 2 a la derecha. TikTok no siempre manda el precio de los regalos: '
          + 'entonces el activador vale lo que pongas en «Monedas del activador» (en 0, el precio del Buscador) y los demás regalos valen su precio del '}
        <a href="#/regalos">Buscador de regalos</a>
        {' (si no está ahí, suman 1). Para ver el efecto en la vista previa: Iniciar y unos regalos de prueba (cae sobre quien va perdiendo); '
          + 'para ver el final, «Terminar ahora».'}
      </Nota>
    </>
  );
}


// -----------------------------------------------------------------------------
// 3. Tarjeta de una bailarina: nombre · ID del activador · monedas · color
// -----------------------------------------------------------------------------

function TarjetaBailarina({ b, i, cambiarCfg }: {
  b: EquipoDuelo; i: number;
  cambiarCfg: (receta: (a: Draft<AjustesDuelo>) => void) => void;
}) {
  const cambiarEsta = (receta: (x: Draft<EquipoDuelo>) => void): void =>
    cambiarCfg((a) => {
      // Si lo guardado tenía menos de 2, se completa con la de siempre antes de cambiarla.
      while (a.equipos.length <= i) a.equipos.push({ ...(POR_DEFECTO.equipos[a.equipos.length] as EquipoDuelo) });
      const x = a.equipos[i];
      if (x) receta(x);
    });

  return (
    <Tarjeta titulo={`Bailarina ${i + 1} · mitad ${LADOS[i]}`}>
      <div className="campos">
        <Campo etiqueta="Nombre:" valor={b.nombre} maxLength={MAX_NOMBRE} alCambiar={(v) => cambiarEsta((x) => { x.nombre = v; })} />
        <Campo
          etiqueta="ID del regalo activador:"
          valor={b.giftId}
          inputMode="numeric"
          placeholder="ID"
          list={LISTA_REGALOS}
          alCambiar={(v) => {
            // Al escribir o elegir un ID del catálogo, se completan su nombre y su precio.
            const giftId = v.trim();
            const delCatalogo = obtener().regalos[giftId];
            cambiarEsta((x) => {
              x.giftId = giftId;
              x.regalo = delCatalogo ? nombreRegalo(delCatalogo) : '';
              if (delCatalogo?.diamantes) x.valor = delCatalogo.diamantes;
            });
          }}
        />
        <Campo etiqueta="Monedas del activador:" tipo="number" valor={b.valor} min={0} step={1} alCambiar={(v) => cambiarEsta((x) => { x.valor = v; })} />
        <Campo etiqueta="Color:" tipo="color" valor={b.color} alCambiar={(v) => cambiarEsta((x) => { x.color = v; })} />
      </div>
      <p className="nota sin-margen">{b.regalo ? `Activador: ${b.regalo}` : ''}</p>
    </Tarjeta>
  );
}
