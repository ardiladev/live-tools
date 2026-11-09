// =============================================================================
// vistas/jefe/VistaJefe.tsx — Juegos → Retos del público → Jefe del LIVE
//
// Configura el widget jefe.html: nombre, vida, tiempo límite, texto de victoria y daño por like
// y por moneda, con la raid (Iniciar / Pausar / Reiniciar) que llega a OBS al instante.
// El widget muestra un monstruo que se rompe a medida que baja la vida y se acomoda solo a la
// forma de la fuente; «Forma de la fuente en OBS» solo cambia la vista previa y el tamaño sugerido.
// La tarjeta «Monstruo» elige cuál de los cinco (del menos al más amenazante); solo cambia el
// dibujo, no las reglas.
// (Port de la sección 3 de legado/js/panel/vistas/jefe.js.)
// =============================================================================

import type { CSSProperties } from 'react';
import { Monstruo } from '../../../widgets/jefe/Monstruo';
import { MONSTRUOS, tipoMonstruo, type TipoMonstruo } from '../../../widgets/jefe/monstruos/catalogo';
import { EditorEstilo } from '../../componentes/EditorEstilo';
import { BotonesReloj, PanelReloj, useRelojDeRonda } from '../../componentes/piezasJuego';
import { TarjetaWidget, type PruebaWidget } from '../../componentes/TarjetaWidget';
import { Campo, Casilla, Nota, numero, Segmentado, Tarjeta } from '../../componentes/ui';
import { temaDe, useAjustesWidget, usarAlmacen } from '../../estado/almacen';
import type { TextosReloj } from '../../piezas';
import { ID, MINUTOS_MAX, MINUTOS_MIN, minutosDe, POR_DEFECTO, type FormaJefe } from './config';

// Desde "Tiempo agotado", iniciar es empezar una raid nueva (vida llena).
const TEXTOS: TextosReloj = {
  listo: ['Lista para empezar', 'Iniciar raid'],
  corre: ['En combate', 'Iniciar raid'],
  pausa: ['En pausa', 'Reanudar'],
  fin: ['Tiempo agotado', 'Nueva raid'],
};

const PRUEBAS: PruebaWidget[] = [
  { texto: '+100 likes', evento: (n) => ({ tipo: 'like', usuario: n, cantidad: 100, total: 0, propios: 100 }) },
  { texto: 'Rosa (1 moneda)', evento: (n) => ({ tipo: 'regalo', usuario: n, giftId: '5655', nombre: 'Rose', cantidad: 1, diamantes: 1, imagen: '' }) },
  { texto: 'Regalo de 100', evento: (n) => ({ tipo: 'regalo', usuario: n, giftId: '0', nombre: 'Regalo', cantidad: 1, diamantes: 100, imagen: '' }) },
  { texto: 'Golpe final (1.000 monedas)', evento: (n) => ({ tipo: 'regalo', usuario: n, giftId: '0', nombre: 'Regalo', cantidad: 1, diamantes: 1000, imagen: '' }) },
];

const NIVELES = ['', 'Travieso', 'Gruñón', 'Peligroso', 'Temible', 'Legendario'] as const;

/** Las cinco fichas de monstruo, con su dibujo en el color del estilo del widget. */
function SelectorMonstruo({ valor, alCambiar }: { valor: TipoMonstruo; alCambiar: (v: TipoMonstruo) => void }) {
  // Primitivos (no el objeto del tema): un selector que devuelve un objeto nuevo re-renderiza sin fin.
  const activo = usarAlmacen((e) => temaDe(e, ID).ca);
  const borde = usarAlmacen((e) => temaDe(e, ID).cb);
  const colores = { '--activo': activo, '--borde-color': borde } as CSSProperties;
  return (
    <div className="selector-monstruo" role="group" aria-label="Monstruo" style={colores}>
      {MONSTRUOS.map((m) => (
        <button key={m.id} type="button" className="ficha-monstruo" aria-pressed={m.id === valor} onClick={() => alCambiar(m.id)} title={m.lema}>
          <Monstruo tipo={m.id} etapa={1} fase="corre" golpes={0} fuerte={false} />
          <span className="ficha-monstruo-nombre">{m.nombre}</span>
          <span className="ficha-monstruo-amenaza" data-nivel={m.amenaza}>
            <span className="ficha-monstruo-puntos" aria-hidden="true">
              {[1, 2, 3, 4, 5].map((n) => <i key={n} className={n <= m.amenaza ? 'lleno' : undefined} />)}
            </span>
            {NIVELES[m.amenaza]}
          </span>
        </button>
      ))}
    </div>
  );
}

const FORMAS = [['franja', 'Franja'], ['escenario', 'Escenario']] as const satisfies ReadonlyArray<readonly [FormaJefe, string]>;

export function VistaJefe() {
  const [cfg, cambiarCfg] = useAjustesWidget(ID, POR_DEFECTO);
  const reloj = useRelojDeRonda({ id: ID, ajustes: cfg, cambiarAjustes: cambiarCfg, duracionS: Math.round(minutosDe(cfg) * 60), textos: TEXTOS });
  const escenario = cfg.forma === 'escenario';

  // Cuánto hace falta para vencer al jefe, para calibrar la vida con el público que suele haber.
  const vida = Math.max(1, Number(cfg.vida) || 1);
  const like = Math.max(0, Number(cfg.danoLike) || 0);
  const moneda = Math.max(0, Number(cfg.danoRegalo) || 0);
  const partes: string[] = [];
  if (like) partes.push(`${numero(Math.ceil(vida / like))} likes`);
  if (moneda) partes.push(`${numero(Math.ceil(vida / moneda))} monedas en regalos`);
  const resumen = partes.length
    ? `Para vencer al jefe hacen falta ${partes.join(' o ')} (o una mezcla).`
    : 'Con el daño en 0, nadie puede quitarle vida al jefe.';

  return (
    <>
      <TarjetaWidget
        id={ID}
        titulo="Jefe del LIVE"
        archivo="jefe.html"
        forma={escenario ? 'cuadrado' : 'horizontal'}
        // El reloj, la ronda y el monstruo cambian sin reiniciar la vista previa (no se pierde el daño de prueba).
        sinRecargar={['t', 'ro', 'mo']}
        campos={(
          <>
            <Campo etiqueta="Nombre del jefe:" valor={cfg.nombre} maxLength={40} alCambiar={(v) => cambiarCfg((a) => { a.nombre = v; })} />
            <Campo etiqueta="Vida total:" tipo="number" valor={cfg.vida} min={1} step={1000} alCambiar={(v) => cambiarCfg((a) => { a.vida = v; })} />
            <Campo etiqueta="Tiempo límite (minutos):" tipo="number" valor={cfg.minutos} min={MINUTOS_MIN} max={MINUTOS_MAX} step={0.5} alCambiar={(v) => cambiarCfg((a) => { a.minutos = v; })} />
            <Campo etiqueta="Texto de victoria:" valor={cfg.textoVictoria} maxLength={40} alCambiar={(v) => cambiarCfg((a) => { a.textoVictoria = v; })} />
            <Segmentado etiqueta="Forma de la fuente en OBS" opciones={FORMAS} valor={escenario ? 'escenario' : 'franja'} alCambiar={(v) => cambiarCfg((a) => { a.forma = v; })} />
          </>
        )}
        personalizar={(
          <>
            <Casilla texto="Los ataques solo cuentan con el reloj en marcha" marcada={cfg.soloConReloj} alCambiar={(v) => cambiarCfg((a) => { a.soloConReloj = v; })} />
            <Casilla texto="Sonidos (últimos segundos, victoria y tiempo agotado)" marcada={cfg.sonido} alCambiar={(v) => cambiarCfg((a) => { a.sonido = v; })} />
            <EditorEstilo id={ID} />
          </>
        )}
        pruebas={PRUEBAS}
      />

      <Tarjeta titulo="Monstruo" ancha>
        <SelectorMonstruo valor={tipoMonstruo(cfg.monstruo)} alCambiar={(v) => cambiarCfg((a) => { a.monstruo = v; })} />
        <Nota>
          Del menos al más amenazante. Todos ponen cara de dolor con cada golpe, se van rompiendo cada vez que pierden un cuarto{' '}
          de la vida, se duermen en pausa, se burlan si se acaba el tiempo y quedan K.O. al vencerlos. Solo cambia el dibujo:{' '}
          la vida y el daño siguen igual.
        </Nota>
      </Tarjeta>

      <Tarjeta titulo="Raid" ancha>
        <PanelReloj reloj={reloj} />
        <div className="fila-acciones separado-arriba">
          <BotonesReloj reloj={reloj} />
          <button onClick={reloj.reiniciar} title="Detiene el reloj y le devuelve al jefe toda su vida">Reiniciar</button>
        </div>
        <Nota>
          Iniciar, pausar y reiniciar llegan a OBS en uno o dos segundos. Reiniciar le devuelve al jefe toda su vida.{' '}
          El panel no ve la vida del jefe: la lleva el widget en OBS. Si el chat lo vence antes de tiempo, OBS muestra la victoria{' '}
          aunque aquí el reloj siga corriendo.
        </Nota>
      </Tarjeta>

      <Tarjeta titulo="Daño" ancha>
        <div className="campos">
          <Campo etiqueta="Vida por like:" tipo="number" valor={cfg.danoLike} min={0} step={1} alCambiar={(v) => cambiarCfg((a) => { a.danoLike = v; })} />
          <Campo etiqueta="Vida por moneda de regalo:" tipo="number" valor={cfg.danoRegalo} min={0} step={1} alCambiar={(v) => cambiarCfg((a) => { a.danoRegalo = v; })} />
          <Campo etiqueta="Monedas de un regalo sin precio:" tipo="number" valor={cfg.valorRegalo} min={0} step={1} alCambiar={(v) => cambiarCfg((a) => { a.valorRegalo = v; })} />
        </div>
        <p className="nota">{resumen}</p>
        <Nota>
          Cada regalo quita (precio × cantidad) × «vida por moneda». TikTok casi nunca manda el precio del regalo:{' '}
          entonces cuenta como «monedas de un regalo sin precio».
        </Nota>
      </Tarjeta>

      {escenario
        ? <Nota>Tamaño recomendado de la fuente en OBS: 1280 × 720 o 1080 × 1080, con el monstruo en grande arriba de la barra. El widget se acomoda solo a la forma de la fuente. El daño de la raid se conserva si OBS recarga la fuente.</Nota>
        : <Nota>Tamaño recomendado de la fuente en OBS: 1920 × 300, arriba de la escena. El daño de la raid se conserva si OBS recarga la fuente.</Nota>}
    </>
  );
}
