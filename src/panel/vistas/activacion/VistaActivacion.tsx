// =============================================================================
// vistas/activacion/VistaActivacion.tsx — Juegos → Competencias → Barra de activación
//
// Configura el widget activacion.html: una sola barra repartida en 2 a 4 cuadrantes, uno por
// equipo, cada uno con nombre, regalo activador, monedas del activador (si TikTok no manda el
// precio) y color. Iniciar/Pausar/Reiniciar cambian el reloj (`t`) o la ronda (`ro`) y se suben
// a Supabase al instante. Se guardan siempre los 4 equipos; los que no están en juego se ocultan.
// (Port de la sección 3 de legado/js/panel/vistas/activacion.js.)
// Secciones: 1. Pruebas · 2. Vista · 3. Tarjeta de un equipo
// =============================================================================

import type { Draft } from 'immer';
import { useRef } from 'react';
import type { EventoRegalo } from '../../../tipos/eventos';
import { EditorEstilo } from '../../componentes/EditorEstilo';
import {
  BotonesReloj, CampoDuracion, ListaRegalos, PanelReloj, useRelojDeRonda,
} from '../../componentes/piezasJuego';
import { TarjetaWidget, type PruebaWidget } from '../../componentes/TarjetaWidget';
import { Aviso, Campo, Casilla, Nota, Segmentado, Tarjeta, useAviso } from '../../componentes/ui';
import { nombreRegalo, obtener, useAjustesWidget } from '../../estado/almacen';
import { textoLimpio, type TextosReloj } from '../../piezas';
import {
  CANTIDADES, cantidadDe, duracionDe, enJuego, ID, MAX_NOMBRE, POR_DEFECTO, problemas,
  type AjustesActivacion, type EquipoAjustes,
} from './config';

const LISTA_REGALOS = 'regalos-activacion';
const OPCIONES_CANTIDAD = CANTIDADES.map((n) => [n, String(n)] as const);

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
  const equipos = enJuego(cfg);

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

  /** Monedas y equipos en 0 y reloj detenido con la duración completa. */
  function reiniciar(): void {
    reloj.reiniciar();
    avisarReinicio('Ronda reiniciada: los equipos vuelven a 0 monedas y todos tienen que volver a unirse.');
  }

  return (
    <>
      <TarjetaWidget
        id={ID}
        titulo="Barra de activación"
        archivo="activacion.html"
        forma="horizontal"
        // El reinicio y el reloj llegan a la vista previa sin recargarla.
        sinRecargar={['ro', 't']}
        personalizar={(
          <>
            <Casilla texto="Sonidos (alguien se une, cambia quién va ganando, final)" marcada={cfg.sonido} alCambiar={(v) => cambiarCfg((a) => { a.sonido = v; })} />
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
        <div className="aviso error" role="status">{problemas(cfg).join(' ')}</div>
        <Nota>
          {'Cómo se juega: hay una sola barra, repartida en un cuadrante por equipo. Cada equipo tiene su regalo activador: quien lo envía '
            + 'se une a ese equipo (ese regalo ya le suma) y, desde ahí, CUALQUIER regalo suyo le suma. Si envía el activador de otro equipo, '
            + 'se cambia: lo que ya sumó se queda donde estaba. Los regalos de quien no se ha unido no suman. Cada cuadrante ocupa de la barra '
            + 'el porcentaje de monedas de su equipo (al empezar, todos miden lo mismo). Unirse se puede antes de iniciar, pero las monedas '
            + 'solo suman con el reloj en marcha. Al llegar a 0, gana el equipo con más monedas. «Nueva ronda» y «Reiniciar ronda» ponen todo '
            + 'en 0 y todos vuelven a unirse.'}
        </Nota>
      </Tarjeta>

      {cfg.barras.map((b, i) => (
        // key = posición: los 4 equipos son fijos, cada uno en su lugar
        <TarjetaEquipo key={i} b={b} i={i} oculta={i >= cantidad} cambiarCfg={cambiarCfg} />
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

function TarjetaEquipo({ b, i, oculta, cambiarCfg }: {
  b: EquipoAjustes; i: number; oculta: boolean;
  cambiarCfg: (receta: (a: Draft<AjustesActivacion>) => void) => void;
}) {
  const cambiarEste = (receta: (x: Draft<EquipoAjustes>) => void): void =>
    cambiarCfg((a) => { const x = a.barras[i]; if (x) receta(x); });

  return (
    <Tarjeta titulo={`Equipo ${i + 1}`} oculta={oculta}>
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
