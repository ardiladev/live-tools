// =============================================================================
// vistas/repertorio/VistaRepertorio.tsx — Juegos → Repertorio
//
// Configura el widget repertorio.html y manda las órdenes: cuál canción es la activa, cuáles ya
// se hicieron y el reinicio. Las órdenes se suben de inmediato (sin la espera habitual) y llegan
// a la vista previa sin recargarla. Las monedas de cada canción las cuenta el widget en OBS.
// (Port de la sección 3 de legado/js/panel/vistas/repertorio.js.)
// Secciones: 1. Vista · 2. Fila de una canción
// =============================================================================

import type { Draft } from 'immer';
import type { EventoRegalo } from '../../../tipos/eventos';
import { EditorEstilo } from '../../componentes/EditorEstilo';
import { TarjetaWidget, type PruebaWidget } from '../../componentes/TarjetaWidget';
import {
  Aviso, Campo, Casilla, EntradaNumero, Nota, Tarjeta, useAviso, type OpcionesSelect,
} from '../../componentes/ui';
import { useAjustesWidget } from '../../estado/almacen';
import { subir } from '../../estado/sincronizar';
import {
  ID, MAX_CANCIONES, MAX_NOMBRE, nuevaCancion, POR_DEFECTO, type AjustesRepertorio, type CancionPanel,
} from './config';

const OPCIONES_VISIBLES: OpcionesSelect = [[3, '3'], [4, '4'], [5, '5']];

const regalo = (cantidad: number, diamantes: number) => (nombre: string): EventoRegalo => ({
  tipo: 'regalo', usuario: nombre, giftId: '0', nombre: 'Regalo', cantidad, diamantes, imagen: '',
});

const PRUEBAS: PruebaWidget[] = [
  { texto: 'Regalo de 100', evento: regalo(1, 100) },
  { texto: 'Rosa ×10', evento: regalo(10, 1) },
  { texto: 'Regalo de 500', evento: regalo(1, 500) },
];

/** La siguiente canción no hecha después de `despuesDe` (o, si no hay, la primera no hecha). */
function siguientePendiente(a: Draft<AjustesRepertorio>, despuesDe: string): Draft<CancionPanel> | undefined {
  const indice = a.canciones.findIndex((c) => c.id === despuesDe);
  return a.canciones.slice(indice + 1).find((c) => !a.hechas.includes(c.id))
    || a.canciones.find((c) => !a.hechas.includes(c.id));
}


// -----------------------------------------------------------------------------
// 1. Vista
// -----------------------------------------------------------------------------

export function VistaRepertorio() {
  const [cfg, cambiarCfg] = useAjustesWidget(ID, POR_DEFECTO);
  const [aviso, avisar] = useAviso();

  /** Guarda y manda a OBS de inmediato (sin la espera habitual). */
  function ordenar(receta: (a: Draft<AjustesRepertorio>) => void, mensaje?: string): void {
    cambiarCfg(receta);
    void subir(ID);
    if (mensaje) avisar(mensaje);
  }

  function activar(c: CancionPanel): void {
    ordenar((a) => {
      a.activa = c.id;
      a.hechas = a.hechas.filter((id) => id !== c.id); // activar una hecha la vuelve a abrir
    }, `«${c.nombre}» es la canción activa.`);
  }

  /** Marca como hecha; si era la activa, pasa a la siguiente pendiente. */
  function marcarHecha(c: CancionPanel): void {
    ordenar((a) => {
      if (!a.hechas.includes(c.id)) a.hechas = [...a.hechas, c.id];
      if (a.activa === c.id) a.activa = siguientePendiente(a, c.id)?.id || c.id;
    }, `«${c.nombre}» marcada como hecha.`);
  }

  function desmarcar(c: CancionPanel): void {
    ordenar((a) => { a.hechas = a.hechas.filter((id) => id !== c.id); }, `«${c.nombre}» vuelve a estar pendiente.`);
  }

  function reiniciar(): void {
    ordenar((a) => {
      a.hechas = [];
      a.activa = a.canciones[0]?.id || '';
      a.ronda = Date.now();
    }, 'Repertorio reiniciado: todas las canciones en 0 y la primera activa.');
  }

  function agregar(): void {
    if (cfg.canciones.length >= MAX_CANCIONES) return;
    const nueva = nuevaCancion(`Canción ${cfg.canciones.length + 1}`);
    cambiarCfg((a) => { a.canciones.push(nueva); });
  }

  /** Cambia de lugar con la vecina (paso = -1 sube, 1 baja). */
  function mover(i: number, paso: number): void {
    const j = i + paso;
    if (j < 0 || j >= cfg.canciones.length) return;
    cambiarCfg((a) => {
      const [c] = a.canciones.splice(i, 1);
      if (c) a.canciones.splice(j, 0, c);
    });
  }

  function quitar(i: number): void {
    ordenar((a) => {
      const [c] = a.canciones.splice(i, 1);
      if (!c) return;
      a.hechas = a.hechas.filter((id) => id !== c.id);
      if (a.activa === c.id) a.activa = a.canciones.find((x) => !a.hechas.includes(x.id))?.id || a.canciones[0]?.id || '';
    });
  }

  function cambiarCancion(id: string, receta: (c: Draft<CancionPanel>) => void): void {
    cambiarCfg((a) => {
      const c = a.canciones.find((x) => x.id === id);
      if (c) receta(c);
    });
  }

  const activaActual = cfg.canciones.find((c) => c.id === cfg.activa);

  return (
    <>
      <TarjetaWidget
        id={ID}
        titulo="Repertorio"
        archivo="repertorio.html"
        forma="vertical"
        // Las órdenes (activa, hechas, reinicio) llegan a la vista previa sin recargarla.
        sinRecargar={['a', 'h', 'ro']}
        campos={(
          <>
            <Campo etiqueta="Título:" valor={cfg.titulo} maxLength={30} alCambiar={(v) => cambiarCfg((a) => { a.titulo = v; })} />
            <Campo etiqueta="Canciones a la vista:" tipo="select" valor={cfg.visibles} opciones={OPCIONES_VISIBLES} alCambiar={(v) => cambiarCfg((a) => { a.visibles = Number(v); })} />
          </>
        )}
        personalizar={(
          <>
            <Campo etiqueta="Monedas de un regalo sin precio:" tipo="number" valor={cfg.valorRegalo} min={0} step={1} alCambiar={(v) => cambiarCfg((a) => { a.valorRegalo = v; })} />
            <Casilla texto="Sonido al desbloquearse una canción" marcada={cfg.sonido} alCambiar={(v) => cambiarCfg((a) => { a.sonido = v; })} />
            <EditorEstilo id={ID} />
          </>
        )}
        pruebas={PRUEBAS}
      />

      <Tarjeta titulo={`Canciones (hasta ${MAX_CANCIONES})`} ancha>
        <div className="fila-acciones">
          <button
            className="principal"
            onClick={() => { if (activaActual) marcarHecha(activaActual); }}
            title="Marca la activa como hecha y activa la siguiente pendiente"
          >
            Hecha y siguiente
          </button>
          <button onClick={reiniciar} title="Todas las canciones en 0, ninguna hecha y la primera activa">Reiniciar repertorio</button>
        </div>
        <Aviso aviso={aviso} />
        <div className="cancion-fila encabezado">
          <span>Estado</span><span>Canción o baile</span><span>Meta (monedas)</span><span /><span /><span /><span /><span />
        </div>
        <div>
          {cfg.canciones.map((c, i) => (
            <FilaCancion
              key={c.id}
              cancion={c}
              indice={i}
              total={cfg.canciones.length}
              activa={c.id === cfg.activa}
              hecha={cfg.hechas.includes(c.id)}
              alCambiar={(receta) => cambiarCancion(c.id, receta)}
              alActivar={() => activar(c)}
              alMarcar={() => marcarHecha(c)}
              alDesmarcar={() => desmarcar(c)}
              alMover={(paso) => mover(i, paso)}
              alQuitar={() => quitar(i)}
            />
          ))}
        </div>
        <button className="enlace separado-arriba" disabled={cfg.canciones.length >= MAX_CANCIONES} onClick={agregar}>+ Agregar canción</button>
        <Nota>
          {'Los regalos (precio × cantidad) se suman a la canción activa. Al llegar a su meta, en OBS queda «Desbloqueada · Sonando»; '
            + 'cuando termines, pulsa «Hecha y siguiente». Las órdenes llegan a OBS en uno o dos segundos. Las monedas de cada canción las '
            + 'cuenta el widget en OBS: el panel no las ve. TikTok casi nunca manda el precio: entonces cuenta como «Monedas de un regalo sin precio» (en Personalizar).'}
        </Nota>
      </Tarjeta>

      <Nota>Tamaño recomendado de la fuente en OBS: 600 × 900, a un costado de la escena. Lo juntado se conserva si OBS recarga la fuente.</Nota>
    </>
  );
}


// -----------------------------------------------------------------------------
// 2. Fila de una canción: estado, nombre, meta y botones
// -----------------------------------------------------------------------------

interface PropsFila {
  cancion: CancionPanel;
  indice: number;
  total: number;
  activa: boolean;
  hecha: boolean;
  alCambiar: (receta: (c: Draft<CancionPanel>) => void) => void;
  alActivar: () => void;
  alMarcar: () => void;
  alDesmarcar: () => void;
  alMover: (paso: number) => void;
  alQuitar: () => void;
}

function FilaCancion({
  cancion: c, indice: i, total, activa, hecha, alCambiar, alActivar, alMarcar, alDesmarcar, alMover, alQuitar,
}: PropsFila) {
  const n = i + 1;
  const estado = hecha ? 'Hecha' : activa ? 'Activa' : 'Pendiente';
  return (
    <div className={hecha ? 'cancion-fila hecha' : activa ? 'cancion-fila activa' : 'cancion-fila'}>
      <span className="cancion-estado">{estado}</span>
      <input
        value={c.nombre}
        maxLength={MAX_NOMBRE}
        aria-label={`Nombre de la canción ${n}`}
        onChange={(e) => { const v = e.target.value; alCambiar((x) => { x.nombre = v; }); }}
      />
      <EntradaNumero
        min={1}
        step={100}
        valor={c.meta}
        aria-label={`Meta en monedas de la canción ${n}`}
        alCambiar={(v) => alCambiar((x) => { x.meta = v; })}
      />
      <button disabled={activa && !hecha} onClick={alActivar} title="Hacer que los regalos vayan a esta canción">Activar</button>
      {hecha
        ? <button onClick={alDesmarcar} title="Volver a dejarla pendiente">Deshacer</button>
        : <button onClick={alMarcar} title="Marcar como hecha (si es la activa, pasa a la siguiente)">Hecha</button>}
      <button title="Subir" aria-label={`Subir la canción ${n}`} disabled={i === 0} onClick={() => alMover(-1)}>↑</button>
      <button title="Bajar" aria-label={`Bajar la canción ${n}`} disabled={i === total - 1} onClick={() => alMover(1)}>↓</button>
      <button title="Quitar" aria-label={`Quitar la canción ${n}`} disabled={total <= 1} onClick={alQuitar}>✕</button>
    </div>
  );
}
