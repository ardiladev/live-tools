// =============================================================================
// vistas/marcador/VistaMarcador.tsx — Juegos → Competencias → Marcador
//
// Configura el widget marcador.html: de 1 a 6 integrantes (color opcional) y el reloj de la ronda
// (Iniciar, Pausar, Reiniciar), que llega a OBS al instante.
// (Port de la sección 3 de legado/js/panel/vistas/marcador.js.)
// =============================================================================

import type { Draft } from 'immer';
import type { EventoRegalo } from '../../../tipos/eventos';
import { EditorEstilo } from '../../componentes/EditorEstilo';
import { BotonesReloj, CampoDuracion, ListaRegalos, PanelReloj, useRelojDeRonda } from '../../componentes/piezasJuego';
import { TarjetaWidget, type PruebaWidget } from '../../componentes/TarjetaWidget';
import { Campo, Casilla, EntradaNumero, Nota, Tarjeta } from '../../componentes/ui';
import { nombreRegalo, obtener, useAjustesWidget } from '../../estado/almacen';
import { textoLimpio } from '../../piezas';
import {
  duracionDe, ID, MAX_INTEGRANTES, MAX_NOMBRE, nuevoIntegrante, POR_DEFECTO, problemasRegalos,
  REGALOS_INICIALES, type AjustesMarcador, type IntegranteMarcadorAjustes,
} from './config';

const LISTA_REGALOS = 'regalos-marcador';
type Elegir = (lista: readonly IntegranteMarcadorAjustes[]) => IntegranteMarcadorAjustes | undefined;

function regaloDePrueba(lista: readonly IntegranteMarcadorAjustes[], cantidad: number, elegir: Elegir) {
  return (nombre: string): EventoRegalo => {
    const j = elegir(lista) || lista[0];
    return {
      tipo: 'regalo', usuario: nombre, giftId: textoLimpio(j?.giftId), nombre: textoLimpio(j?.regalo),
      cantidad, diamantes: Math.max(1, Number(j?.valor) || 1), imagen: '',
    };
  };
}
const alAzar: Elegir = (lista) => lista[Math.floor(Math.random() * lista.length)];

export function VistaMarcador() {
  const [cfg, cambiarCfg] = useAjustesWidget(ID, POR_DEFECTO);
  const duracionS = duracionDe(cfg);
  const reloj = useRelojDeRonda({ id: ID, ajustes: cfg, cambiarAjustes: cambiarCfg, duracionS });
  const problemas = problemasRegalos(cfg.integrantes);

  const pruebas: PruebaWidget[] = [
    { texto: 'Regalo al azar', evento: regaloDePrueba(cfg.integrantes, 1, alAzar) },
    { texto: 'Combo ×10 al azar', evento: regaloDePrueba(cfg.integrantes, 10, alAzar) },
    { texto: 'Combo ×50 al primero', evento: regaloDePrueba(cfg.integrantes, 50, (lista) => lista[0]) },
  ];

  function agregar(): void {
    cambiarCfg((a) => {
      if (a.integrantes.length >= MAX_INTEGRANTES) return;
      // El primer regalo inicial que nadie tenga todavía, para no repetir.
      const usados = new Set(a.integrantes.map((j) => textoLimpio(j.giftId)));
      const libre = REGALOS_INICIALES.find((r) => r.giftId && !usados.has(r.giftId)) || REGALOS_INICIALES[REGALOS_INICIALES.length - 1];
      a.integrantes.push({ ...nuevoIntegrante(a.integrantes.length), ...libre });
    });
  }

  return (
    <>
      <TarjetaWidget
        id={ID}
        titulo="Marcador"
        archivo="marcador.html"
        forma="horizontal"
        sinRecargar={['t', 'ro']}
        campos={<Campo etiqueta="Título junto al reloj (opcional):" valor={cfg.titulo} maxLength={30} alCambiar={(v) => cambiarCfg((a) => { a.titulo = v; })} />}
        personalizar={(
          <>
            <Casilla texto="Contar regalos solo con el reloj en marcha" marcada={cfg.soloConReloj} alCambiar={(v) => cambiarCfg((a) => { a.soloConReloj = v; })} />
            <Casilla texto="Sonido al terminar el tiempo" marcada={cfg.sonido} alCambiar={(v) => cambiarCfg((a) => { a.sonido = v; })} />
            <EditorEstilo id={ID} />
          </>
        )}
        pruebas={pruebas}
      />

      <Tarjeta titulo="Reloj de la ronda" ancha>
        <PanelReloj reloj={reloj} />
        <div className="fila-acciones separado-arriba">
          <BotonesReloj reloj={reloj} />
          <button onClick={reloj.reiniciar} title="Detiene el reloj y pone los puntos de todos en 0">Reiniciar</button>
        </div>
        <CampoDuracion etiqueta="Duración (segundos):" valor={cfg.duracion} duracionS={duracionS} alCambiar={(v) => cambiarCfg((a) => { a.duracion = v; })} />
        <Nota>
          Iniciar, pausar y reiniciar llegan a OBS en uno o dos segundos. Reiniciar pone los puntos de todos en 0.{' '}
          Por defecto los regalos suman siempre, hasta reiniciar; en Personalizar puedes hacer que solo cuenten con el reloj en marcha.
        </Nota>
      </Tarjeta>

      <Tarjeta titulo={`Integrantes (1 a ${MAX_INTEGRANTES})`} ancha>
        <div className="integrante-fila sin-meta encabezado">
          <span>Color</span><span>Nombre</span><span>ID regalo</span><span>Nombre del regalo</span><span>Monedas c/u</span><span />
        </div>
        <div>
          {cfg.integrantes.map((j, i) => (
            <FilaIntegrante key={j.id} j={j} i={i} total={cfg.integrantes.length} cambiarCfg={cambiarCfg} />
          ))}
        </div>
        <ListaRegalos id={LISTA_REGALOS} />
        <div className="aviso error" role="status">{problemas.join(' ')}</div>
        <button className="enlace separado-arriba" onClick={agregar} disabled={cfg.integrantes.length >= MAX_INTEGRANTES}>+ Agregar integrante</button>
        <Nota>
          Cada regalo suma monedas × cantidad. TikTok no siempre manda el precio: entonces vale lo que pongas en «Monedas c/u».{' '}
          Si el ID no coincide, se busca por el nombre del regalo (como lo manda TikTok, en inglés). Con la casilla del color desmarcada,{' '}
          la tarjeta usa el acento del estilo. Busca los IDs en el <a href="#/regalos">Buscador de regalos</a>.
        </Nota>
      </Tarjeta>

      <Nota>Tamaño recomendado de la fuente en OBS: 1920 × 400, arriba de la escena. Los puntos de la ronda se conservan si OBS recarga la fuente.</Nota>
    </>
  );
}

/** Una fila: color (con su casilla) · nombre · ID · nombre del regalo · monedas · quitar. */
function FilaIntegrante({ j, i, total, cambiarCfg }: {
  j: IntegranteMarcadorAjustes; i: number; total: number;
  cambiarCfg: (receta: (a: Draft<AjustesMarcador>) => void) => void;
}) {
  const n = i + 1;
  const cambiarEste = (receta: (x: Draft<IntegranteMarcadorAjustes>) => void): void =>
    cambiarCfg((a) => { const x = a.integrantes[i]; if (x) receta(x); });

  return (
    <div className="integrante-fila sin-meta">
      {/* Color opcional: sin marcar, la tarjeta usa el acento del estilo. */}
      <div className="color-opcional">
        <input type="checkbox" checked={j.usarColor} title="Usar un color propio" aria-label={`Usar color propio en el integrante ${n}`} onChange={(e) => cambiarEste((x) => { x.usarColor = e.target.checked; })} />
        <input type="color" value={j.color} disabled={!j.usarColor} aria-label={`Color del integrante ${n}`} onChange={(e) => cambiarEste((x) => { x.color = e.target.value; })} />
      </div>
      <input value={j.nombre} maxLength={MAX_NOMBRE} aria-label={`Nombre del integrante ${n}`} onChange={(e) => cambiarEste((x) => { x.nombre = e.target.value; })} />
      <input
        value={j.giftId}
        inputMode="numeric"
        placeholder="ID"
        list={LISTA_REGALOS}
        aria-label={`ID del regalo del integrante ${n}`}
        onChange={(e) => {
          // Al escribir o elegir un ID del catálogo, se completan su nombre y su precio.
          const giftId = e.target.value.trim();
          const delCatalogo = obtener().regalos[giftId];
          cambiarEste((x) => {
            x.giftId = giftId;
            if (delCatalogo) {
              x.regalo = nombreRegalo(delCatalogo) || x.regalo;
              if (delCatalogo.diamantes) x.valor = delCatalogo.diamantes;
            }
          });
        }}
      />
      <input value={j.regalo} maxLength={40} placeholder="Nombre" aria-label={`Nombre del regalo del integrante ${n}`} onChange={(e) => cambiarEste((x) => { x.regalo = e.target.value; })} />
      <EntradaNumero valor={j.valor} min={0} step={1} aria-label={`Monedas por regalo del integrante ${n}`} alCambiar={(v) => cambiarEste((x) => { x.valor = v; })} />
      <button title="Quitar" aria-label={`Quitar al integrante ${n}`} disabled={total <= 1} onClick={() => cambiarCfg((a) => { a.integrantes.splice(i, 1); })}>✕</button>
    </div>
  );
}
