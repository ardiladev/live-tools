// =============================================================================
// vistas/jefe/VistaJefe.tsx — Juegos → Retos del público → Jefe del LIVE
//
// Configura el widget jefe.html: nombre, vida, tiempo límite, texto de victoria y daño por like
// y por moneda, con la raid (Iniciar / Pausar / Reiniciar) que llega a OBS al instante.
// El widget muestra un monstruo que se rompe a medida que baja la vida y se acomoda solo a la
// forma de la fuente; «Forma de la fuente en OBS» solo cambia la vista previa y el tamaño sugerido.
// La tarjeta «Monstruo» elige cuál de los cinco (del menos al más amenazante); solo cambia el
// dibujo, no las reglas.
// Modo «Mascota del LIVE» (fase 4): el mismo widget, pero el público hace crecer a una mascota
// (VistaMascota, abajo).
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
import { subir } from '../../estado/sincronizar';
import type { TextosReloj } from '../../piezas';
import {
  esMascota, ID, mascotaDe, MINUTOS_MAX, MINUTOS_MIN, minutosDe, POR_DEFECTO, POR_DEFECTO_MASCOTA,
  type AjustesJefe, type AjustesMascota, type FormaJefe,
} from './config';

const MODOS = [['jefe', 'Jefe del LIVE'], ['mascota', 'Mascota del LIVE']] as const;

const PRUEBAS_MASCOTA: PruebaWidget[] = [
  { texto: '+100 likes', evento: (n) => ({ tipo: 'like', usuario: n, cantidad: 100, total: 0, propios: 100 }) },
  { texto: 'Regalo de 10', evento: (n) => ({ tipo: 'regalo', usuario: n, giftId: '0', nombre: 'Regalo', cantidad: 1, diamantes: 10, imagen: '' }) },
  { texto: 'Mensaje en el chat', evento: (n) => ({ tipo: 'chat', usuario: n, texto: '¡Hola!' }) },
  { texto: 'Regalo de 100', evento: (n) => ({ tipo: 'regalo', usuario: n, giftId: '0', nombre: 'Regalo', cantidad: 1, diamantes: 100, imagen: '' }) },
];

/** Elegir entre el jefe y la mascota (el mismo widget y la misma URL). */
function TarjetaModo({ cfg, cambiarCfg }: { cfg: AjustesJefe; cambiarCfg: (r: (a: AjustesJefe) => void) => void }) {
  const mascota = esMascota(cfg);
  return (
    <div className="opciones-conteo">
      <h3 className="subtitulo">Modo de juego</h3>
      <Segmentado
        etiqueta="Cómo se juega:"
        opciones={MODOS}
        valor={mascota ? 'mascota' : 'jefe'}
        alCambiar={(v) => { cambiarCfg((a) => { a.modo = v; a.ronda = Date.now(); a.reloj = { e: 'listo', fin: 0, r: 0 }; }); void subir(ID); }}
      />
      <Nota>
        {mascota
          ? 'Mascota del LIVE: una mascota que crece con los regalos (le dan de comer), se alegra con los likes y se duerme si nadie escribe en el chat. Tiene 5 niveles, de Bebé a Leyenda.'
          : 'Jefe del LIVE: el público le quita vida a un monstruo antes de que se acabe el tiempo. Prueba la «Mascota del LIVE»: el mismo widget, pero el público la hace crecer.'}
      </Nota>
    </div>
  );
}

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
  if (esMascota(cfg)) return <VistaMascota cfg={cfg} cambiarCfg={cambiarCfg} />;
  return <VistaRaid cfg={cfg} cambiarCfg={cambiarCfg} />;
}

function VistaRaid({ cfg, cambiarCfg }: { cfg: AjustesJefe; cambiarCfg: (r: (a: AjustesJefe) => void) => void }) {
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
            <TarjetaModo cfg={cfg} cambiarCfg={cambiarCfg} />
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


/** Modo «Mascota del LIVE»: nombre, color, cuánto crece y cuándo se duerme. */
function VistaMascota({ cfg, cambiarCfg }: { cfg: AjustesJefe; cambiarCfg: (r: (a: AjustesJefe) => void) => void }) {
  const m = mascotaDe(cfg);
  const cambiar = (cambios: Partial<AjustesMascota>): void => cambiarCfg((a) => { a.mascota = { ...POR_DEFECTO_MASCOTA, ...(a.mascota || {}), ...cambios }; });
  const partes: string[] = [];
  if (m.porLike) partes.push(`${numero(Math.ceil(m.puntosNivel / m.porLike))} likes`);
  if (m.porMoneda) partes.push(`${numero(Math.ceil(m.puntosNivel / m.porMoneda))} monedas en regalos`);

  return (
    <>
      <TarjetaWidget
        id={ID}
        titulo="Mascota del LIVE"
        archivo="jefe.html"
        forma="vertical"
        sinRecargar={['ro', 'ti', 'mc', 'hp', 'dl', 'dr', 'zz']}
        campos={(
          <>
            <Campo etiqueta="Nombre de la mascota:" valor={m.nombre} maxLength={30} alCambiar={(v) => cambiar({ nombre: v })} />
            <Campo etiqueta="Color:" tipo="color" valor={m.color} alCambiar={(v) => cambiar({ color: v })} />
            <Campo etiqueta="Puntos para subir de nivel:" tipo="number" valor={m.puntosNivel} min={1} step={100} alCambiar={(v) => cambiar({ puntosNivel: v })} />
          </>
        )}
        personalizar={(
          <>
            <TarjetaModo cfg={cfg} cambiarCfg={cambiarCfg} />
            <Casilla texto="Sonidos (comer y subir de nivel)" marcada={cfg.sonido} alCambiar={(v) => cambiarCfg((a) => { a.sonido = v; })} />
            <EditorEstilo id={ID} />
          </>
        )}
        pruebas={PRUEBAS_MASCOTA}
      />

      <Tarjeta titulo="Cómo crece" ancha>
        <div className="campos">
          <Campo etiqueta="Puntos por like:" tipo="number" valor={m.porLike} min={0} step={1} alCambiar={(v) => cambiar({ porLike: v })} />
          <Campo etiqueta="Puntos por moneda de regalo:" tipo="number" valor={m.porMoneda} min={0} step={1} alCambiar={(v) => cambiar({ porMoneda: v })} />
          <Campo etiqueta="Monedas de un regalo sin precio:" tipo="number" valor={cfg.valorRegalo} min={0} step={1} alCambiar={(v) => cambiarCfg((a) => { a.valorRegalo = v; })} />
          <Campo etiqueta="Segundos sin chat para dormirse (0 = nunca):" tipo="number" valor={m.sueno} min={0} step={10} alCambiar={(v) => cambiar({ sueno: v })} />
        </div>
        <p className="nota">{partes.length ? `Cada nivel pide ${partes.join(' o ')} (o una mezcla).` : 'Con los puntos en 0, la mascota no crece.'}</p>
        <div className="fila-acciones separado-arriba">
          <button onClick={() => { cambiarCfg((a) => { a.ronda = Date.now(); }); void subir(ID); }} title="La mascota vuelve a ser bebé (nivel 1)">Volver a empezar</button>
        </div>
        <Nota>
          Los regalos le dan de comer (y la despiertan), los likes la ponen feliz y un mensaje en el chat la despierta. Niveles: Bebé, Pequeña,{' '}
          Juguetona (con moño), Grande (con capa) y Leyenda (con corona); con cada uno se ve más grande. El panel no ve sus puntos: los lleva el widget{' '}
          en OBS y se conservan si OBS recarga la fuente.
        </Nota>
      </Tarjeta>

      <Nota>Tamaño recomendado de la fuente en OBS: 600 × 700 (o 1080 × 1080).</Nota>
    </>
  );
}
