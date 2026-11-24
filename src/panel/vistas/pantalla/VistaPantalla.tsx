// =============================================================================
// vistas/pantalla/VistaPantalla.tsx — Bailarinas → En pantalla
//
// Dos vistas de la misma fábrica (index.ts), cada una con su widget y su URL:
//   - «Bailarinas en pantalla»: tarjetas con la meta de la noche y los top fans de cada una;
//     las partes se encienden o apagan en Personalizar (sistema modular).
//   - «Créditos finales»: los nombres que ruedan al cerrar el LIVE, con «Volver a pasar».
// El widget (pantalla.html) no escucha el LIVE: lee lo que anota el Registro de bailarinas en
// Supabase, así que primero tiene que estar el Registro en LIVE Studio. La vista previa muestra
// datos de ejemplo (y los botones de prueba les suman monedas) mientras no haya un LIVE anotado.
// Secciones: 1. Vista · 2. Opciones de las tarjetas · 3. Opciones de los créditos
// =============================================================================

import type { Draft } from 'immer';
import { nubeActiva } from '../../../nucleo/nube';
import type { EventoRegalo } from '../../../tipos/eventos';
import { MAX_BAILARINAS_PANTALLA, MAX_FANS } from '../../../widgets/pantalla/config';
import { ID_REGISTRO, type Bailarina } from '../../bailarinas';
import { SelectorBailarinas, useBailarinasActivas } from '../../componentes/Bailarinas';
import { EditorEstilo } from '../../componentes/EditorEstilo';
import { TarjetaWidget, type PruebaWidget } from '../../componentes/TarjetaWidget';
import {
  Aviso, Campo, Casilla, EntradaNumero, Nota, numero, Segmentado, Tarjeta, useAviso,
} from '../../componentes/ui';
import { tieneIdNube, useAjustesWidget, usarAlmacen } from '../../estado/almacen';
import { subir } from '../../estado/sincronizar';
import { porDefectoDe, VARIANTES, type AjustesPantalla, type IdPantalla } from './config';

type Cambiar = (receta: (a: Draft<AjustesPantalla>) => void) => void;

/** Claves que la vista previa aplica sin reiniciarse (así no se pierden las pruebas sumadas). */
const SIN_RECARGAR = ['b', 'rg', 'dsd', 'me', 'mt', 'ms', 'tf', 'mf', 'om', 'di', 's', 'ti', 'fi', 'vc', 'bu', 'ro'];

const OPCIONES_FANS = [0, 1, 2, 3, 4, 5].filter((n) => n <= MAX_FANS).map((n) => [n, n ? String(n) : 'No'] as const);
const OPCIONES_DIRECCION = [['v', 'En columna'], ['h', 'En fila']] as const;
const OPCIONES_VELOCIDAD = [[1, 'Lenta'], [2, 'Normal'], [3, 'Rápida']] as const;

const regalo = (b: Bailarina, monedas: number) => (usuario: string): EventoRegalo => ({
  tipo: 'regalo', usuario, giftId: b.giftId || '5655', nombre: b.regalo || 'Regalo', cantidad: 1, diamantes: monedas, imagen: '',
});


// -----------------------------------------------------------------------------
// 1. Vista
// -----------------------------------------------------------------------------

export function VistaPantalla({ id }: { id: IdPantalla }) {
  const [cfg, cambiarCfg] = useAjustesWidget(id, porDefectoDe(id));
  const activas = useBailarinasActivas();
  const conRegistro = usarAlmacen((e) => tieneIdNube(e, ID_REGISTRO));
  const [aviso, avisar] = useAviso();
  const creditos = id === 'creditos';
  const marcadas = cfg.bailarinas.filter((x) => activas.some((b) => b.id === x));
  const enPantalla = (marcadas.length ? marcadas.map((x) => activas.find((b) => b.id === x) as Bailarina) : activas)
    .slice(0, MAX_BAILARINAS_PANTALLA);

  function elegir(bailarina: string, si: boolean): void {
    cambiarCfg((a) => {
      // Sin ninguna marcada salen todas: al desmarcar la primera, quedan marcadas las demás.
      const actuales = a.bailarinas.filter((x) => activas.some((b) => b.id === x));
      const base = actuales.length ? actuales : activas.map((b) => b.id);
      a.bailarinas = si ? [...base.filter((x) => x !== bailarina), bailarina] : base.filter((x) => x !== bailarina);
    });
  }

  function volverAPasar(): void {
    cambiarCfg((a) => { a.ronda = (Number(a.ronda) || 0) + 1; });
    void subir(id);
    avisar('Los créditos empiezan otra vez desde el principio.');
  }

  const pruebas: PruebaWidget[] = enPantalla.slice(0, 3).flatMap((b, i) => (i === 0
    ? [{ texto: `+100 a ${b.nombre}`, evento: regalo(b, 100) }, { texto: `+1.000 a ${b.nombre}`, evento: regalo(b, 1000) }]
    : [{ texto: `+100 a ${b.nombre}`, evento: regalo(b, 100) }]));

  return (
    <>
      <SelectorBailarinas
        titulo={creditos ? 'Quiénes salen en los créditos' : 'Quiénes salen en pantalla'}
        columnas={['Aparece']}
        columnaDe={(x) => (!marcadas.length || marcadas.includes(x) ? 0 : -1)}
        alElegir={(x, columna) => elegir(x, columna === 0)}
        nota={`Sin ninguna marcada salen todas las activas (hasta ${MAX_BAILARINAS_PANTALLA}), en el orden en que las marques.`}
      />

      {creditos ? (
        <Tarjeta titulo="Créditos" ancha>
          <div className="fila-acciones">
            <button className="principal" onClick={volverAPasar}>Volver a pasar</button>
          </div>
          <Aviso aviso={aviso} />
          <Nota>
            Pon la fuente al final del LIVE (o en la escena de despedida): al abrirse, los créditos empiezan solos. Muestran a
            quienes regalaron en el LIVE actual, agrupados por bailarina y de mayor a menor apoyo (hasta 300 por bailarina).
          </Nota>
        </Tarjeta>
      ) : null}

      <TarjetaWidget
        id={id}
        titulo={VARIANTES[id].titulo}
        archivo="pantalla.html"
        forma={creditos ? 'vertical' : cfg.direccion === 'h' ? 'horizontal' : 'vertical'}
        sinRecargar={SIN_RECARGAR}
        personalizar={(
          <>
            {creditos ? <OpcionesCreditos cfg={cfg} cambiarCfg={cambiarCfg} /> : <OpcionesTarjetas cfg={cfg} cambiarCfg={cambiarCfg} enPantalla={enPantalla} />}
            <EditorEstilo id={id} />
          </>
        )}
        pruebas={pruebas}
      />

      {!nubeActiva() ? <div className="aviso error">Este widget necesita los cambios en vivo (Supabase).</div> : null}
      {nubeActiva() && !conRegistro ? (
        <div className="aviso error">
          Todavía no está el Registro de bailarinas: copia su URL en <a href="#/bailarinas">Bailarinas → Registro</a> y pégala en LIVE
          Studio. Este widget muestra lo que ese registro anota.
        </div>
      ) : null}
      <Nota>
        {creditos
          ? 'Tamaño recomendado de la fuente: 1080 × 1920 (pantalla completa). '
          : 'Tamaño recomendado de la fuente: 420 × 1200 en columna o 1920 × 380 en fila. '}
        Se llena solo con lo que anota el <a href="#/bailarinas">Registro de bailarinas</a> en el LIVE actual (se actualiza cada
        pocos segundos y vuelve a 0 con «Empezar un LIVE nuevo»). No se conecta al LIVE por su cuenta. En la vista previa, mientras
        no haya nada anotado, se ven datos de ejemplo.
      </Nota>
    </>
  );
}


// -----------------------------------------------------------------------------
// 2. Opciones de las tarjetas: meta, top fans y ubicación (cada parte se enciende o apaga)
// -----------------------------------------------------------------------------

function OpcionesTarjetas({ cfg, cambiarCfg, enPantalla }: { cfg: AjustesPantalla; cambiarCfg: Cambiar; enPantalla: readonly Bailarina[] }) {
  return (
    <>
      <Casilla texto="Barra con la meta de la noche" marcada={cfg.conMeta} alCambiar={(v) => cambiarCfg((a) => { a.conMeta = v; })} />
      {cfg.conMeta ? (
        <>
          <div className="campos">
            <Campo etiqueta="Meta de cada una (monedas):" tipo="number" min={1} step={100} valor={cfg.meta} alCambiar={(v) => cambiarCfg((a) => { a.meta = Math.max(1, v); })} />
          </div>
          <Casilla
            texto="Al cumplirla, la meta sube otro tanto (1.000 → 2.000 → 3.000…)"
            marcada={cfg.escalonada}
            alCambiar={(v) => cambiarCfg((a) => { a.escalonada = v; })}
          />
          {enPantalla.length > 1 ? (
            <div className="contenedor-tabla separado-arriba">
              <table className="tabla tabla-bailarinas">
                <thead><tr><th>Meta propia</th><th>Monedas (vacío = {numero(cfg.meta)})</th></tr></thead>
                <tbody>
                  {enPantalla.map((b) => (
                    <tr key={b.id}>
                      <td>{b.nombre}</td>
                      <td>
                        <EntradaNumero
                          valor={cfg.metas?.[b.id] || ''}
                          min={0}
                          step={100}
                          placeholder={String(cfg.meta)}
                          aria-label={`Meta propia de ${b.nombre}`}
                          alCambiar={(v) => cambiarCfg((a) => {
                            a.metas ??= {};
                            if (v > 0) a.metas[b.id] = v;
                            else delete a.metas[b.id];
                          })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : null}

      <div className="separado-arriba">
        <Segmentado etiqueta="Top fans de cada una:" opciones={OPCIONES_FANS} valor={Number(cfg.fans) || 0} alCambiar={(v) => cambiarCfg((a) => { a.fans = v; })} />
      </div>
      {cfg.fans > 0 ? (
        <Casilla texto="Mostrar las monedas de cada fan" marcada={cfg.monedasFans} alCambiar={(v) => cambiarCfg((a) => { a.monedasFans = v; })} />
      ) : null}

      <div className="separado-arriba">
        <Segmentado etiqueta="Ubicación:" opciones={OPCIONES_DIRECCION} valor={cfg.direccion === 'h' ? 'h' : 'v'} alCambiar={(v) => cambiarCfg((a) => { a.direccion = v; })} />
      </div>
      <Casilla texto="La que más lleva va primero (si no, en el orden de la lista)" marcada={cfg.ordenar} alCambiar={(v) => cambiarCfg((a) => { a.ordenar = v; })} />
      <Casilla texto="Sonido al cumplir la meta" marcada={cfg.sonido} alCambiar={(v) => cambiarCfg((a) => { a.sonido = v; })} />
      <Nota>Apaga la meta y deja solo los top fans (o al revés) para tener cada cosa en su propia fuente.</Nota>
    </>
  );
}


// -----------------------------------------------------------------------------
// 3. Opciones de los créditos
// -----------------------------------------------------------------------------

function OpcionesCreditos({ cfg, cambiarCfg }: { cfg: AjustesPantalla; cambiarCfg: Cambiar }) {
  return (
    <>
      <div className="campos">
        <Campo etiqueta="Título:" valor={cfg.titulo} maxLength={60} alCambiar={(v) => cambiarCfg((a) => { a.titulo = v; })} />
        <Campo etiqueta="Texto final:" valor={cfg.final} maxLength={80} alCambiar={(v) => cambiarCfg((a) => { a.final = v; })} />
      </div>
      <div className="separado-arriba">
        <Segmentado etiqueta="Velocidad:" opciones={OPCIONES_VELOCIDAD} valor={Number(cfg.velocidad) || 2} alCambiar={(v) => cambiarCfg((a) => { a.velocidad = v; })} />
      </div>
      <Casilla texto="Volver a empezar al terminar (si no, se detienen en el texto final)" marcada={cfg.bucle} alCambiar={(v) => cambiarCfg((a) => { a.bucle = v; })} />
      <Casilla texto="Mostrar las monedas de cada persona" marcada={cfg.monedasFans} alCambiar={(v) => cambiarCfg((a) => { a.monedasFans = v; })} />
    </>
  );
}
