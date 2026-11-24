// =============================================================================
// vistas/boveda/VistaBoveda.tsx — Juegos → Retos del público → Bóveda dorada
//
// Configura el widget boveda.html: meta, texto secreto, título y pista, con las órdenes
// "Cerrar y reiniciar" y "Abrir ahora" (llegan a OBS al instante).
// (Port de la sección 3 de legado/js/panel/vistas/boveda.js.)
// Modo «Mapa de aventura» (fase 4, en Personalizar): las mismas monedas mueven una ficha por un
// camino de casillas (premio, reto o trampa) hasta el tesoro (el texto secreto).
// =============================================================================

import type { Draft } from 'immer';
import { nubeActiva } from '../../../nucleo/nube';
import type { TipoCasilla } from '../../../widgets/boveda/config';
import { EditorEstilo } from '../../componentes/EditorEstilo';
import { TarjetaWidget, type PruebaWidget } from '../../componentes/TarjetaWidget';
import { Aviso, Campo, Casilla, Nota, numero, Segmentado, Tarjeta, useAviso } from '../../componentes/ui';
import { useAjustesWidget } from '../../estado/almacen';
import { subir } from '../../estado/sincronizar';
import { asegurarCola } from '../cola/compartido';
import {
  esMapa, ID, mapaDe, MAX_CASILLAS_MAPA, POR_DEFECTO, POR_DEFECTO_MAPA, type AjustesBoveda, type AjustesMapa,
} from './config';

const MODOS = [['boveda', 'Bóveda dorada'], ['mapa', 'Mapa de aventura']] as const;
const TIPOS: ReadonlyArray<readonly [TipoCasilla, string]> = [['p', '🎁 Premio'], ['r', '🔥 Reto'], ['t', '⚠️ Trampa']];

const PRUEBAS: PruebaWidget[] = [
  { texto: 'Regalo de 100', evento: (n) => ({ tipo: 'regalo', usuario: n, giftId: '0', nombre: 'Regalo', cantidad: 1, diamantes: 100, imagen: '' }) },
  { texto: 'Rosa ×10', evento: (n) => ({ tipo: 'regalo', usuario: n, giftId: '5655', nombre: 'Rose', cantidad: 10, diamantes: 1, imagen: '' }) },
  { texto: 'Regalo de 1.000', evento: (n) => ({ tipo: 'regalo', usuario: n, giftId: '0', nombre: 'Regalo', cantidad: 1, diamantes: 1000, imagen: '' }) },
];

export function VistaBoveda() {
  const [cfg, cambiarCfg] = useAjustesWidget(ID, POR_DEFECTO);
  const [aviso, avisar] = useAviso();
  const mapa = esMapa(cfg);
  const m = mapaDe(cfg);
  const cambiarMapa = (receta: (x: Draft<AjustesMapa>) => void): void => cambiarCfg((a) => {
    const actual = { ...POR_DEFECTO_MAPA, ...(a.mapa || {}) } as AjustesMapa;
    a.mapa = { ...actual, casillas: actual.casillas.map((c) => ({ ...c })) };
    receta(a.mapa as Draft<AjustesMapa>);
  });

  /** Guarda y manda a OBS de inmediato (sin la espera habitual). */
  function ordenar(cambios: Partial<AjustesBoveda>, mensaje: string): void {
    cambiarCfg((a) => { Object.assign(a, cambios); });
    void subir(ID);
    avisar(mensaje);
  }

  const casillasValidas = m.casillas.filter((c) => c.texto.trim()).length;
  const estado = mapa
    ? (cfg.abierta
      ? 'Tesoro abierto desde el panel. «Volver a la salida» empieza el camino de nuevo.'
      : `La ficha avanza una casilla cada ${numero(m.porCasilla)} monedas: el tesoro está a ${numero((casillasValidas + 1) * m.porCasilla)} monedas.`)
    : cfg.abierta
      ? 'Abierta desde el panel con «Abrir ahora». Se cierra con «Cerrar y reiniciar».'
      : `Cerrada: se abre sola al juntar ${numero(Math.max(1, Number(cfg.meta) || 1))} monedas en regalos.`;

  return (
    <>
      <TarjetaWidget
        id={ID}
        titulo={mapa ? 'Mapa de aventura' : 'Bóveda dorada'}
        archivo="boveda.html"
        forma="horizontal"
        // Las órdenes del panel llegan a la vista previa sin recargarla (no se pierde el progreso de prueba).
        sinRecargar={['ro', 'ab']}
        campos={mapa ? (
          <>
            <Campo etiqueta="Monedas por casilla:" tipo="number" valor={m.porCasilla} min={1} step={10} alCambiar={(v) => cambiarMapa((x) => { x.porCasilla = v; })} />
            <Campo etiqueta="Premio del tesoro (secreto):" valor={cfg.secreto} maxLength={80} placeholder="K-pop dance solo" alCambiar={(v) => cambiarCfg((a) => { a.secreto = v; })} />
            <Campo etiqueta="Título:" valor={cfg.titulo} maxLength={40} alCambiar={(v) => cambiarCfg((a) => { a.titulo = v; })} />
            <Campo etiqueta="Pista (abajo del mapa):" valor={cfg.pista} maxLength={60} alCambiar={(v) => cambiarCfg((a) => { a.pista = v; })} />
          </>
        ) : (
          <>
            <Campo etiqueta="Meta (monedas):" tipo="number" valor={cfg.meta} min={1} step={100} alCambiar={(v) => cambiarCfg((a) => { a.meta = v; })} />
            <Campo etiqueta="Texto secreto:" valor={cfg.secreto} maxLength={80} placeholder="K-pop dance solo" alCambiar={(v) => cambiarCfg((a) => { a.secreto = v; })} />
            <Campo etiqueta="Título:" valor={cfg.titulo} maxLength={40} alCambiar={(v) => cambiarCfg((a) => { a.titulo = v; })} />
            <Campo etiqueta="Pista (se ve con la bóveda cerrada):" valor={cfg.pista} maxLength={60} alCambiar={(v) => cambiarCfg((a) => { a.pista = v; })} />
          </>
        )}
        personalizar={(
          <>
            <div className="opciones-conteo">
              <h3 className="subtitulo">Modo de juego</h3>
              <Segmentado
                etiqueta="Cómo se juega:"
                opciones={MODOS}
                valor={mapa ? 'mapa' : 'boveda'}
                alCambiar={(v) => {
                  cambiarCfg((a) => {
                    // Los textos de fábrica acompañan al modo; los propios se respetan.
                    if (v === 'mapa' && a.titulo.trim() === POR_DEFECTO.titulo) a.titulo = 'Mapa de aventura';
                    if (v === 'boveda' && a.titulo.trim() === 'Mapa de aventura') a.titulo = POR_DEFECTO.titulo;
                    if (v === 'mapa' && a.pista.trim() === POR_DEFECTO.pista) a.pista = 'Cada regalo nos acerca al tesoro';
                    if (v === 'boveda' && a.pista.trim() === 'Cada regalo nos acerca al tesoro') a.pista = POR_DEFECTO.pista;
                    a.modo = v; a.ronda = Date.now(); a.abierta = false;
                  });
                  void subir(ID);
                }}
              />
              <Nota className="sin-margen">
                {mapa
                  ? 'Mapa de aventura: los regalos mueven la ficha del público por un camino de casillas (premio, reto o trampa) hasta el tesoro. Al cambiar de modo, empieza desde 0.'
                  : 'Bóveda dorada: los regalos llenan una barra hasta abrir el premio secreto. Prueba el «Mapa de aventura»: un camino de casillas hasta el tesoro. Al cambiar de modo, empieza desde 0.'}
              </Nota>
            </div>
            <Campo etiqueta="Monedas de un regalo sin precio:" tipo="number" valor={cfg.valorRegalo} min={0} step={1} alCambiar={(v) => cambiarCfg((a) => { a.valorRegalo = v; })} />
            <Casilla texto="Sonido al abrirse" marcada={cfg.sonido} alCambiar={(v) => cambiarCfg((a) => { a.sonido = v; })} />
            <EditorEstilo id={ID} />
          </>
        )}
        pruebas={PRUEBAS}
      />

      {mapa ? (
        <Tarjeta titulo={`Casillas del camino (${numero(casillasValidas)})`} ancha>
          <div className="lista-castigos">
            {m.casillas.map((c, i) => (
              // Las casillas no tienen id: se identifican por su posición en el camino.
              // eslint-disable-next-line react/no-array-index-key
              <div key={i} className="texto-fila casilla-mapa">
                <select value={c.tipo} aria-label={`Tipo de la casilla ${i + 1}`} onChange={(e) => cambiarMapa((x) => { const y = x.casillas[i]; if (y) y.tipo = e.target.value as TipoCasilla; })}>
                  {TIPOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                </select>
                <input value={c.texto} maxLength={60} aria-label={`Casilla ${i + 1}`} onChange={(e) => cambiarMapa((x) => { const y = x.casillas[i]; if (y) y.texto = e.target.value; })} />
                <button type="button" aria-label={`Quitar la casilla ${i + 1}`} onClick={() => cambiarMapa((x) => { x.casillas.splice(i, 1); })}>✕</button>
              </div>
            ))}
          </div>
          <button type="button" className="enlace" disabled={m.casillas.length >= MAX_CASILLAS_MAPA} onClick={() => cambiarMapa((x) => { x.casillas.push({ tipo: 'r', texto: '' }); })}>
            + Agregar casilla
          </button>
          {nubeActiva() && m.casillas.some((c) => c.tipo !== 'p' && c.texto.trim()) ? (
            <Casilla
              texto="Mandar los retos y trampas a la Cola de retos al caer en ellos"
              marcada={m.aCola}
              alCambiar={(v) => { cambiarMapa((x) => { x.aCola = v; }); if (v) void asegurarCola(); }}
            />
          ) : null}
          <Nota>
            {`Hasta ${MAX_CASILLAS_MAPA} casillas, en orden desde la salida. Después de la última está el tesoro (el premio secreto). `
              + 'Si un regalo grande hace avanzar varias casillas, cuenta la casilla donde cae la ficha.'}
          </Nota>
        </Tarjeta>
      ) : null}

      <Tarjeta titulo={mapa ? 'Camino' : 'Bóveda'} ancha>
        <p className="nota sin-margen">{estado}</p>
        <div className="fila-acciones separado-arriba">
          <button className="principal" title={mapa ? 'La ficha vuelve a la salida y las monedas a 0' : 'Cierra la bóveda y pone el progreso en 0'} onClick={() => ordenar({ ronda: Date.now(), abierta: false }, mapa ? 'La ficha volvió a la salida en OBS.' : 'Bóveda cerrada y en 0 en OBS.')}>
            {mapa ? 'Volver a la salida' : 'Cerrar y reiniciar'}
          </button>
          <button title={mapa ? 'Abre el tesoro aunque la ficha no haya llegado' : 'Abre la bóveda y revela el secreto aunque no se haya llegado a la meta'} onClick={() => ordenar({ abierta: true }, mapa ? 'Tesoro abierto en OBS.' : 'Bóveda abierta en OBS.')}>
            {mapa ? 'Abrir el tesoro' : 'Abrir ahora'}
          </button>
        </div>
        <Aviso aviso={aviso} />
        <Nota>
          Las órdenes llegan a OBS en uno o dos segundos. El progreso lo cuenta el widget en OBS, que es quien recibe los regalos:{' '}
          el panel no lo ve. Si OBS recarga la fuente, el progreso se conserva hasta que cierres y reinicies.
        </Nota>
      </Tarjeta>

      <Nota>
        Cada regalo suma precio × cantidad. TikTok casi nunca manda el precio: entonces cuenta como «Monedas de un regalo sin precio»{' '}
        (en Personalizar). El texto secreto no se muestra en pantalla hasta que la bóveda se abre. Tamaño recomendado de la fuente en OBS: 1200 × 400.
      </Nota>
    </>
  );
}
