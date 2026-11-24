// =============================================================================
// vistas/activacion/VistaActivacion.tsx — Juegos → Competencias → Barra de activación
//
// Configura el widget activacion.html: una sola barra repartida en 2 a 4 cuadrantes, uno por
// equipo, cada uno con nombre, regalo activador, monedas del activador (si TikTok no manda el
// precio) y color. Iniciar/Pausar/Reiniciar cambian el reloj (`t`) o la ronda (`ro`) y se suben
// a Supabase al instante. Se guardan siempre los 4 equipos; los que no están en juego se ocultan.
// (Port de la sección 3 de legado/js/panel/vistas/activacion.js.)
// Modo «Subasta de canciones» (fase 4, en Personalizar): las mismas reglas, pero cada equipo es una
// canción y el widget se ve como un tablero de subasta.
// Secciones: 1. Pruebas · 2. Vista · 3. Tarjeta de un equipo
// =============================================================================

import type { Draft } from 'immer';
import { useRef } from 'react';
import type { EventoRegalo } from '../../../tipos/eventos';
import { OpcionesConteo } from '../../componentes/Modulos';
import { OpcionesFinal } from '../../componentes/OpcionesFinal';
import { conChat, fuenteDe, palabrasEquipo } from '../../modulos';
import type { EventoChat, EventoLike } from '../../../tipos/eventos';
import { EditorEstilo } from '../../componentes/EditorEstilo';
import {
  BotonesReloj, CampoDuracion, ListaRegalos, PanelReloj, useRelojDeRonda,
} from '../../componentes/piezasJuego';
import { TarjetaWidget, type PruebaWidget } from '../../componentes/TarjetaWidget';
import { Aviso, Campo, Casilla, Nota, Segmentado, Tarjeta, useAviso } from '../../componentes/ui';
import { asignarBailarina, bailarinasDe, completarParticipante, problemasEquipo, type Bailarina } from '../../bailarinas';
import { MiembrosEquipo, SelectorBailarinas, useBailarinasActivas } from '../../componentes/Bailarinas';
import { nombreRegalo, obtener, useAjustesWidget, usarAlmacen } from '../../estado/almacen';
import { textoLimpio, type TextosReloj } from '../../piezas';
import {
  CANTIDADES, cantidadDe, duracionDe, enJuego, ID, MAX_NOMBRE, POR_DEFECTO, problemas,
  esSubasta, TITULO_SUBASTA, type AjustesActivacion, type EquipoAjustes,
} from './config';

const LISTA_REGALOS = 'regalos-activacion';
const OPCIONES_CANTIDAD = CANTIDADES.map((n) => [n, String(n)] as const);
const MODOS = [['barra', 'Barra de activación'], ['subasta', 'Subasta de canciones']] as const;

const TEXTOS: TextosReloj = {
  listo: ['Lista: ya se pueden unir, pero los regalos aún no suman', 'Iniciar'],
  corre: ['En juego: los regalos suman', 'Iniciar'],
  pausa: ['En pausa: los regalos no suman', 'Reanudar'],
  fin: ['Terminó la ronda', 'Nueva ronda'],
};


// -----------------------------------------------------------------------------
// 1. Pruebas: unirse a un equipo (con su activador) y regalos de quien ya se unió
// -----------------------------------------------------------------------------

const NOMBRES = ['Camila', 'Mateo', 'Sofía', 'Samuel', 'Isabella', 'Tomás', 'Mariana', 'Emiliano'];

const activador = (b: EquipoAjustes | undefined, nombre: string, cantidad = 1): EventoRegalo => ({
  tipo: 'regalo', usuario: nombre, giftId: textoLimpio(b?.giftId), nombre: textoLimpio(b?.regalo),
  cantidad, diamantes: Math.max(1, Number(b?.valor) || 1), imagen: '',
});

const otroRegalo = (cantidad: number, diamantes: number) => (nombre: string): EventoRegalo => ({
  tipo: 'regalo', usuario: nombre, giftId: '0', nombre: 'Regalo', cantidad, diamantes, imagen: '',
});


// -----------------------------------------------------------------------------
// 2. Vista
// -----------------------------------------------------------------------------

export function VistaActivacion() {
  const [cfg, cambiarCfg] = useAjustesWidget(ID, POR_DEFECTO);
  const duracionS = duracionDe(cfg);
  const reloj = useRelojDeRonda({ id: ID, ajustes: cfg, cambiarAjustes: cambiarCfg, duracionS, textos: TEXTOS });
  const [avisoReinicio, avisarReinicio] = useAviso();
  const siguiente = useRef(0); // «Unirme al siguiente equipo» va rotando mientras la vista está abierta
  const cantidad = cantidadDe(cfg);
  const subasta = esSubasta(cfg);
  const estado = usarAlmacen((e) => e);
  const registradas = useBailarinasActivas();
  // Con bailarinas, el equipo toma sus datos (los mismos que van al widget).
  const equipos = enJuego(cfg).map((e) => completarParticipante(estado, e, e.bailarinas));
  const avisosBailarinas = equipos.flatMap((e, i) => problemasEquipo(estado, `el equipo ${i + 1}`, e.giftId, e.bailarinas));

  const siguienteChat = useRef(0);
  const pruebas: PruebaWidget[] = [
    { texto: 'Unirme al siguiente equipo', evento: (nombre) => activador(equipos[siguiente.current++ % cantidad], nombre) },
    { texto: 'Mi regalo de 25', evento: otroRegalo(1, 25) },
    { texto: 'Mi combo ×10 rosas', evento: otroRegalo(10, 1) },
    {
      texto: 'Otra persona se une',
      // Primero el equipo y después el nombre (el mismo orden de azar del original).
      evento: () => activador(
        equipos[Math.floor(Math.random() * equipos.length)],
        NOMBRES[Math.floor(Math.random() * NOMBRES.length)] ?? 'Camila',
        5,
      ),
    },
  ];

  // Pruebas de los módulos (solo si están encendidos): unirse por el chat y tap tap.
  if (conChat(cfg)) {
    pruebas.push({
      texto: 'Escribir en el chat (unirme)',
      evento: (nombre): EventoChat => ({ tipo: 'chat', usuario: nombre, texto: palabrasEquipo(siguienteChat.current % equipos.length, equipos[siguienteChat.current++ % equipos.length]?.nombre ?? '')[0] ?? 'A' }),
    });
  }
  if (fuenteDe(cfg) !== 'regalos') {
    pruebas.push({ texto: 'Tap tap ×50', evento: (nombre): EventoLike => ({ tipo: 'like', usuario: nombre, cantidad: 50, total: 0, propios: 50 }) });
  }

  /** Monedas y equipos en 0 y reloj detenido con la duración completa. */
  function reiniciar(): void {
    reloj.reiniciar();
    avisarReinicio('Ronda reiniciada: los equipos vuelven a 0 monedas y todos tienen que volver a unirse.');
  }

  return (
    <>
      <TarjetaWidget
        id={ID}
        titulo={subasta ? 'Subasta de canciones' : 'Barra de activación'}
        archivo="activacion.html"
        forma={subasta ? 'cuadrado' : 'horizontal'}
        // El reinicio y el reloj llegan a la vista previa sin recargarla.
        sinRecargar={['ro', 't']}
        personalizar={(
          <>
            <div className="opciones-conteo">
              <h3 className="subtitulo">Modo de juego</h3>
              <Segmentado
                etiqueta="Cómo se ve:"
                opciones={MODOS}
                valor={subasta ? 'subasta' : 'barra'}
                alCambiar={(v) => cambiarCfg((a) => { a.modo = v; })}
              />
              {subasta ? (
                <Campo etiqueta="Título del tablero:" valor={cfg.tituloSubasta ?? TITULO_SUBASTA} maxLength={40} alCambiar={(v) => cambiarCfg((a) => { a.tituloSubasta = v; })} />
              ) : null}
              <Nota className="sin-margen">
                {subasta
                  ? 'Subasta de canciones: cada equipo es una canción (ponle su nombre). El público puja con regalos (su activador, o escribiendo su nombre si unirse por el chat está encendido) y al acabarse el tiempo gana la que más monedas juntó: «¡Se baila!».'
                  : 'Barra de activación: una barra repartida entre los equipos. Prueba la «Subasta de canciones»: las mismas reglas, con un tablero de subasta.'}
              </Nota>
            </div>
            <Casilla texto="Sonidos (alguien se une, cambia quién va ganando, final)" marcada={cfg.sonido} alCambiar={(v) => cambiarCfg((a) => { a.sonido = v; })} />
            <OpcionesConteo
              ajustes={cfg}
              cambiar={cambiarCfg}
              palabras={equipos.map((e, i) => ({ equipo: `Equipo ${i + 1}`, lista: palabrasEquipo(i, e.nombre, e.miembros) }))}
            />
            {subasta ? null : <OpcionesFinal ajustes={cfg} cambiar={cambiarCfg} />}
            <EditorEstilo id={ID} />
          </>
        )}
        pruebas={pruebas}
      />

      <Tarjeta titulo="Ronda" ancha>
        <PanelReloj reloj={reloj} />
        <div className="fila-acciones separado-arriba">
          <BotonesReloj reloj={reloj} />
          <button onClick={reiniciar} title="Detiene el reloj, pone los equipos en 0 y saca a todos de sus equipos">Reiniciar ronda</button>
        </div>
        <CampoDuracion etiqueta="Duración de cada ronda (segundos):" valor={cfg.duracion} duracionS={duracionS} alCambiar={(v) => cambiarCfg((a) => { a.duracion = v; })} />
        <div className="separado-arriba">
          <Segmentado etiqueta="Equipos (cuadrantes de la barra):" opciones={OPCIONES_CANTIDAD} valor={cantidad} alCambiar={(n) => cambiarCfg((a) => { a.cantidad = n; })} />
        </div>
        <Aviso aviso={avisoReinicio} />
        <div className="aviso error" role="status">{[...problemas(cfg, estado), ...avisosBailarinas].join(' ')}</div>
        <Nota>
          {'Cómo se juega: hay una sola barra, repartida en un cuadrante por equipo. Cada equipo tiene su regalo activador: quien lo envía '
            + 'se une a ese equipo (ese regalo ya le suma) y, desde ahí, CUALQUIER regalo suyo le suma. Si envía el activador de otro equipo, '
            + 'se cambia: lo que ya sumó se queda donde estaba. Los regalos de quien no se ha unido no suman. Cada cuadrante ocupa de la barra '
            + 'el porcentaje de monedas de su equipo (al empezar, todos miden lo mismo). Unirse se puede antes de iniciar, pero las monedas '
            + 'solo suman con el reloj en marcha. Al llegar a 0, gana el equipo con más monedas. «Nueva ronda» y «Reiniciar ronda» ponen todo '
            + 'en 0 y todos vuelven a unirse.'}
        </Nota>
      </Tarjeta>

      <SelectorBailarinas
        columnas={equipos.map((_, i) => `Equipo ${i + 1}`)}
        columnaDe={(id) => equipos.findIndex((e) => e.bailarinas?.includes(id))}
        alElegir={(id, columna) => cambiarCfg((a) => { asignarBailarina(a.barras, id, columna, registradas); })}
        nota="Marca a cada bailarina en su equipo: con una sola, el equipo toma su nombre, color, activador y foto. Con varias, el equipo usa su propio regalo y lo que le regalen se reparte entre ellas en el registro."
      />

      {cfg.barras.map((b, i) => (
        // key = posición: los 4 equipos son fijos, cada uno en su lugar
        <TarjetaEquipo key={i} b={b} i={i} oculta={i >= cantidad} miembros={bailarinasDe(estado, b.bailarinas)} cambiarCfg={cambiarCfg} nombre={subasta ? 'Canción' : 'Equipo'} />
      ))}
      <ListaRegalos id={LISTA_REGALOS} />

      <Nota>
        {'TikTok no siempre manda el precio de los regalos: entonces el activador vale lo que pongas en «Monedas del activador» '
          + '(en 0, el precio del Buscador) y los demás regalos valen su precio del '}
        <a href="#/regalos">Buscador de regalos</a>
        {' (si no está ahí, suman 1). Tamaño recomendado de la fuente en OBS: 1600 × 400, arriba de la escena.'}
      </Nota>
    </>
  );
}


// -----------------------------------------------------------------------------
// 3. Tarjeta de un equipo: nombre · ID del activador · monedas · color
// -----------------------------------------------------------------------------

function TarjetaEquipo({ b, i, oculta, miembros, cambiarCfg, nombre = 'Equipo' }: {
  b: EquipoAjustes; i: number; oculta: boolean;
  /** «Equipo» o, en la subasta, «Canción». */
  nombre?: string;
  /** Sus bailarinas (con una, el equipo es ella: no hay nada que editar aquí). */
  miembros: Bailarina[];
  cambiarCfg: (receta: (a: Draft<AjustesActivacion>) => void) => void;
}) {
  const cambiarEste = (receta: (x: Draft<EquipoAjustes>) => void): void =>
    cambiarCfg((a) => { const x = a.barras[i]; if (x) receta(x); });

  if (miembros.length === 1) {
    return (
      <Tarjeta titulo={`${nombre} ${i + 1}`} oculta={oculta}>
        <MiembrosEquipo miembros={miembros} />
      </Tarjeta>
    );
  }

  return (
    <Tarjeta titulo={`${nombre} ${i + 1}`} oculta={oculta}>
      <MiembrosEquipo miembros={miembros} />
      <div className="campos">
        <Campo etiqueta="Nombre:" valor={b.nombre} maxLength={MAX_NOMBRE} alCambiar={(v) => cambiarEste((x) => { x.nombre = v; })} />
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
            cambiarEste((x) => {
              x.giftId = giftId;
              x.regalo = delCatalogo ? nombreRegalo(delCatalogo) : '';
              if (delCatalogo?.diamantes) x.valor = delCatalogo.diamantes;
            });
          }}
        />
        <Campo etiqueta="Monedas del activador:" tipo="number" valor={b.valor} min={0} step={1} alCambiar={(v) => cambiarEste((x) => { x.valor = v; })} />
        <Campo etiqueta="Color:" tipo="color" valor={b.color} alCambiar={(v) => cambiarEste((x) => { x.color = v; })} />
      </div>
      <p className="nota sin-margen">{b.regalo ? `Activador: ${b.regalo}` : ''}</p>
    </Tarjeta>
  );
}
