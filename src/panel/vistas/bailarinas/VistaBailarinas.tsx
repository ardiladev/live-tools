// =============================================================================
// vistas/bailarinas/VistaBailarinas.tsx — Bailarinas → Registro
//
// Aquí se registran las bailarinas (nombre, color, regalo activador y foto con recorte) y se
// configura el widget invisible "Registro de bailarinas" (registro.html), que anota en Supabase
// los regalos de cada una. Lo anotado se consulta y se exporta en Bailarinas → Historial.
// Las bailarinas activas aparecen con una palomita en la barra de activación, el duelo, la
// batalla, la carrera y el marcador (componentes/Bailarinas.tsx).
// Las fotos se recortan en el navegador (EditorFoto), se guardan aquí y se suben a Supabase
// para que los widgets en OBS las muestren (ver src/nucleo/fotos.ts).
// Secciones: 1. Fotos en Supabase · 2. Pruebas · 3. Vista · 4. Fila de una bailarina
// =============================================================================

import type { Draft } from 'immer';
import { useEffect, useRef, useState } from 'react';
import { guardarFotoLocal, olvidarFotoLocal } from '../../../nucleo/fotos';
import { borrarFoto, guardarFoto, idAleatorio, nubeActiva } from '../../../nucleo/nube';
import type { EventoRegalo } from '../../../tipos/eventos';
import {
  COLORES_BAILARINAS, ID_REGISTRO, MAX_NOMBRE_BAILARINA, POR_DEFECTO_REGISTRO,
  type AjustesRegistro, type Bailarina,
} from '../../bailarinas';
import { FotoBailarina } from '../../componentes/Bailarinas';
import { EditorEstilo } from '../../componentes/EditorEstilo';
import { EditorFoto } from '../../componentes/EditorFoto';
import { ListaRegalos } from '../../componentes/piezasJuego';
import { TarjetaWidget, type PruebaWidget } from '../../componentes/TarjetaWidget';
import { Aviso, Casilla, EntradaNumero, Nota, numero, Tarjeta, useAviso } from '../../componentes/ui';
import {
  asegurarIdNube, asegurarSecreto, cambiarWidget, nombreRegalo, obtener, useAjustesWidget, usarAlmacen,
} from '../../estado/almacen';
import { subir } from '../../estado/sincronizar';
import { textoLimpio } from '../../piezas';
import { problemasRegistro } from './config';

const LISTA_REGALOS = 'regalos-bailarinas';
const MAX_BAILARINAS = 60;
type Cambiar = (receta: (a: Draft<AjustesRegistro>) => void) => void;


// -----------------------------------------------------------------------------
// 1. Fotos en Supabase
// -----------------------------------------------------------------------------
// La foto queda guardada en el panel (para mostrarla y volver a subirla si algo falla) y en
// Supabase (para los widgets). Supabase solo acepta fotos de un registro que ya existe: antes
// de subir, se guarda la configuración del widget registro (con su identificador).

let subiendo: Promise<void> | null = null;

/** Sube las fotos que falten (las que tienen `fotoSubida` en falso). Devuelve el error, o ''. */
async function subirFotosPendientes(): Promise<string> {
  if (!nubeActiva()) return '';
  if (subiendo) await subiendo;
  let error = '';
  subiendo = (async () => {
    const pendientes = (obtener().widgets[ID_REGISTRO] as Partial<AjustesRegistro> | undefined)?.bailarinas
      ?.filter((b) => b.fotoId && b.foto && !b.fotoSubida) || [];
    if (!pendientes.length) return;
    try {
      const registro = asegurarIdNube(ID_REGISTRO);
      if (!(await subir(ID_REGISTRO))) throw new Error('no se pudo guardar el registro en Supabase');
      for (const b of pendientes) {
        await guardarFoto(registro, asegurarSecreto(), b.fotoId, b.foto);
        marcarSubida(b.id, b.fotoId);
      }
    } catch (e) {
      error = `No se pudo subir la foto: ${(e as Error).message}. Se reintenta al volver a esta sección.`;
    }
  })();
  await subiendo;
  subiendo = null;
  return error;
}

/** Marca la foto como subida (si mientras tanto no la cambiaron por otra). */
function marcarSubida(id: string, fotoId: string): void {
  cambiarWidget(ID_REGISTRO, POR_DEFECTO_REGISTRO, (a) => {
    const b = a.bailarinas.find((x) => x.id === id);
    if (b && b.fotoId === fotoId) b.fotoSubida = true;
  });
}

/** Borra una foto vieja de Supabase y de este navegador (si falla, no pasa nada: solo ocupa lugar). */
function olvidarFoto(fotoId: string): void {
  if (!fotoId) return;
  olvidarFotoLocal(fotoId);
  if (!nubeActiva() || !obtener().nube.ids[ID_REGISTRO]) return;
  borrarFoto(asegurarIdNube(ID_REGISTRO), asegurarSecreto(), fotoId).catch(() => {});
}


// -----------------------------------------------------------------------------
// 2. Pruebas (en la vista previa del widget, que nunca guarda nada)
// -----------------------------------------------------------------------------

const NOMBRES = ['Camila', 'Mateo', 'Sofía', 'Samuel', 'Isabella', 'Tomás', 'Mariana', 'Emiliano'];
const alAzar = <T,>(lista: readonly T[]): T | undefined => lista[Math.floor(Math.random() * lista.length)];

const activadorDe = (b: Bailarina | undefined, usuario: string): EventoRegalo => ({
  tipo: 'regalo', usuario, uid: `prueba-${usuario}`, giftId: textoLimpio(b?.giftId) || '0', nombre: textoLimpio(b?.regalo),
  cantidad: 1, diamantes: 0, imagen: '',
});

const regalo = (cantidad: number, diamantes: number, giftId = '0', nombre = 'Regalo') => (usuario: string): EventoRegalo => ({
  tipo: 'regalo', usuario, uid: `prueba-${usuario}`, giftId, nombre, cantidad, diamantes, imagen: '',
});


// -----------------------------------------------------------------------------
// 3. Vista
// -----------------------------------------------------------------------------

export function VistaBailarinas() {
  const [cfg, cambiarCfg] = useAjustesWidget(ID_REGISTRO, POR_DEFECTO_REGISTRO);
  const estado = usarAlmacen((e) => e);
  const [aviso, avisar] = useAviso(7000);
  const [editandoFoto, setEditandoFoto] = useState<string | null>(null);
  const siguiente = useRef(0);
  const activas = cfg.bailarinas.filter((b) => b.activa !== false);
  const problemas = problemasRegistro(estado);

  // Al abrir la sección, sube las fotos que hayan quedado sin subir.
  useEffect(() => {
    void subirFotosPendientes().then((error) => { if (error) avisar(error, { error: true }); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pruebas: PruebaWidget[] = [
    { texto: 'Activar a la siguiente', evento: (nombre) => activadorDe(activas[siguiente.current++ % Math.max(1, activas.length)], nombre) },
    { texto: 'Mi regalo de 25', evento: regalo(1, 25) },
    { texto: 'Mi combo ×10 rosas', evento: regalo(10, 1, '5655', 'Rose') },
    { texto: 'Otra persona activa a otra', evento: () => activadorDe(alAzar(activas), alAzar(NOMBRES) ?? 'Camila') },
  ];

  function agregar(): void {
    cambiarCfg((a) => {
      if (a.bailarinas.length >= MAX_BAILARINAS) return;
      const n = a.bailarinas.length;
      a.bailarinas.push({
        id: idAleatorio(8), nombre: `Bailarina ${n + 1}`, color: COLORES_BAILARINAS[n % COLORES_BAILARINAS.length] ?? '#D4AF37',
        giftId: '', regalo: '', valor: 1, foto: '', fotoId: '', fotoSubida: false, activa: true,
      });
    });
  }

  function usarFoto(id: string, datos: string): void {
    const anterior = cfg.bailarinas.find((b) => b.id === id)?.fotoId || '';
    const fotoId = idAleatorio(12);
    guardarFotoLocal(fotoId, datos); // la vista previa de los juegos la ve al instante
    cambiarCfg((a) => {
      const b = a.bailarinas.find((x) => x.id === id);
      if (b) Object.assign(b, { foto: datos, fotoId, fotoSubida: false });
    });
    setEditandoFoto(null);
    void subirFotosPendientes().then((error) => {
      if (error) avisar(error, { error: true });
      else {
        avisar(nubeActiva() ? 'Foto guardada: ya la ven los widgets en OBS.' : 'Foto guardada.');
        olvidarFoto(anterior);
      }
    });
  }

  function quitarFoto(id: string): void {
    const anterior = cfg.bailarinas.find((b) => b.id === id)?.fotoId || '';
    cambiarCfg((a) => {
      const b = a.bailarinas.find((x) => x.id === id);
      if (b) Object.assign(b, { foto: '', fotoId: '', fotoSubida: false });
    });
    olvidarFoto(anterior);
  }

  function quitar(id: string): void {
    const anterior = cfg.bailarinas.find((b) => b.id === id)?.fotoId || '';
    cambiarCfg((a) => { a.bailarinas = a.bailarinas.filter((b) => b.id !== id); });
    olvidarFoto(anterior);
    if (editandoFoto === id) setEditandoFoto(null);
  }

  function liveNuevo(): void {
    cambiarCfg((a) => { a.ronda = (Number(a.ronda) || 0) + 1; });
    void subir(ID_REGISTRO);
    avisar('Listo: desde ahora es otro LIVE. Para que un regalo cuente, hay que volver a enviar el activador.');
  }

  const enEdicion = cfg.bailarinas.find((b) => b.id === editandoFoto);

  return (
    <>
      <Tarjeta titulo={`Bailarinas (${numero(cfg.bailarinas.length)})`} ancha>
        {cfg.bailarinas.length ? (
          <div className="bailarina-fila encabezado" aria-hidden="true">
            <span>Foto</span><span>Nombre</span><span>Color</span><span>ID del activador</span><span>Monedas del activador</span><span>Activa</span><span />
          </div>
        ) : null}
        <div>
          {cfg.bailarinas.map((b, i) => (
            <FilaBailarina
              key={b.id}
              b={b}
              i={i}
              cambiarCfg={cambiarCfg}
              alEditarFoto={() => setEditandoFoto(b.id)}
              alQuitar={() => quitar(b.id)}
            />
          ))}
        </div>
        {!cfg.bailarinas.length ? <p className="nota">Todavía no hay bailarinas. Agrega la primera con el botón de abajo.</p> : null}
        <ListaRegalos id={LISTA_REGALOS} />
        <div className="aviso error" role="status">{problemas.join(' ')}</div>
        <Aviso aviso={aviso} />
        <button className="enlace separado-arriba" onClick={agregar} disabled={cfg.bailarinas.length >= MAX_BAILARINAS}>+ Agregar bailarina</button>
        <Nota>
          Toca la foto para subir una y encuadrarla. El ID del activador se busca en el{' '}
          <a href="#/regalos">Buscador de regalos</a> (al escribirlo se completa su precio). Las bailarinas activas aparecen con una{' '}
          palomita en la Barra de activación, el Duelo VS, la Batalla, la Carrera y el Marcador; las inactivas se guardan, pero no{' '}
          juegan ni se anotan.
        </Nota>
      </Tarjeta>

      {enEdicion ? (
        <Tarjeta titulo={`Foto de ${enEdicion.nombre}`} ancha>
          <EditorFoto key={enEdicion.id} alUsar={(datos) => usarFoto(enEdicion.id, datos)} alCancelar={() => setEditandoFoto(null)} />
          {enEdicion.foto ? (
            <button className="enlace separado-arriba" onClick={() => { quitarFoto(enEdicion.id); setEditandoFoto(null); }}>Quitar la foto actual</button>
          ) : null}
        </Tarjeta>
      ) : null}

      <TarjetaWidget
        id={ID_REGISTRO}
        titulo="Registro de bailarinas (widget invisible)"
        archivo="registro.html"
        forma="cuadrado"
        // Pausar y «LIVE nuevo» llegan a la vista previa sin reiniciarla.
        sinRecargar={['ac', 'ro']}
        personalizar={<EditorEstilo id={ID_REGISTRO} />}
        pruebas={pruebas}
      />

      <Tarjeta titulo="Cómo se anota" ancha>
        <Casilla
          texto="Anotar los regalos de las bailarinas (apágalo para que el widget no anote nada)"
          marcada={cfg.anotando}
          alCambiar={(v) => { cambiarCfg((a) => { a.anotando = v; }); void subir(ID_REGISTRO); }}
        />
        <div className="fila-acciones separado-arriba">
          <button onClick={liveNuevo} title="Nadie queda con ninguna bailarina: hay que volver a enviar su activador">Empezar un LIVE nuevo</button>
          <a className="boton-enlace" href="#/historial">Ver el historial →</a>
        </div>
        <Nota>
          Quien envía el regalo activador de una bailarina queda con ella: ese regalo y TODOS los que envíe después se le anotan,{' '}
          haya o no un juego corriendo, hasta que envíe el activador de otra. Si en un juego armas un equipo de varias bailarinas,{' '}
          quien envía el regalo de ese equipo queda con todas y lo que regale se reparte entre ellas en partes iguales.{' '}
          Quien no ha activado a ninguna no se anota. Tras 2 horas sin regalos empieza otro LIVE solo (y nadie sigue con nadie);{' '}
          «Empezar un LIVE nuevo» lo hace ya.
        </Nota>
        <Nota>
          Pega la URL de este widget UNA sola vez en LIVE Studio u OBS, en una escena que esté siempre abierta (no se ve: puede ir{' '}
          con cualquier tamaño). Abierta en dos lugares, cada regalo se anotaría dos veces. Si se corta internet, lo anotado espera{' '}
          y se manda solo al volver.
        </Nota>
        {!nubeActiva() ? <div className="aviso error">El registro necesita los cambios en vivo (Supabase).</div> : null}
      </Tarjeta>
    </>
  );
}


// -----------------------------------------------------------------------------
// 4. Fila de una bailarina: foto · nombre · color · activador · monedas · activa · quitar
// -----------------------------------------------------------------------------

function FilaBailarina({ b, i, cambiarCfg, alEditarFoto, alQuitar }: {
  b: Bailarina; i: number; cambiarCfg: Cambiar; alEditarFoto: () => void; alQuitar: () => void;
}) {
  const [confirmar, setConfirmar] = useState(false);
  useEffect(() => {
    if (!confirmar) return undefined;
    const espera = setTimeout(() => setConfirmar(false), 4000);
    return () => clearTimeout(espera);
  }, [confirmar]);

  const n = i + 1;
  const cambiarEsta = (receta: (x: Draft<Bailarina>) => void): void =>
    cambiarCfg((a) => { const x = a.bailarinas.find((y) => y.id === b.id); if (x) receta(x); });

  return (
    <div className={b.activa === false ? 'bailarina-fila inactiva' : 'bailarina-fila'}>
      <button type="button" className="boton-foto" title="Subir o cambiar la foto" aria-label={`Foto de ${b.nombre}`} onClick={alEditarFoto}>
        <FotoBailarina b={b} grande />
        <span className="pendiente" hidden={!b.fotoId || b.fotoSubida} title="La foto todavía no está en Supabase">●</span>
      </button>
      <input value={b.nombre} maxLength={MAX_NOMBRE_BAILARINA} aria-label={`Nombre de la bailarina ${n}`} onChange={(e) => cambiarEsta((x) => { x.nombre = e.target.value; })} />
      <input type="color" value={b.color} aria-label={`Color de ${b.nombre}`} onChange={(e) => cambiarEsta((x) => { x.color = e.target.value; })} />
      <span className="campo-activador">
        <input
          value={b.giftId}
          inputMode="numeric"
          placeholder="ID"
          list={LISTA_REGALOS}
          aria-label={`ID del regalo activador de ${b.nombre}`}
          onChange={(e) => {
            // Al escribir o elegir un ID del catálogo, se completan su nombre y su precio.
            const giftId = e.target.value.trim();
            const delCatalogo = obtener().regalos[giftId];
            cambiarEsta((x) => {
              x.giftId = giftId;
              x.regalo = delCatalogo ? nombreRegalo(delCatalogo) : '';
              if (delCatalogo?.diamantes) x.valor = delCatalogo.diamantes;
            });
          }}
        />
        <small>{b.regalo}</small>
      </span>
      <EntradaNumero valor={b.valor} min={0} step={1} aria-label={`Monedas del activador de ${b.nombre}`} alCambiar={(v) => cambiarEsta((x) => { x.valor = v; })} />
      <input type="checkbox" checked={b.activa !== false} aria-label={`${b.nombre} activa`} onChange={(e) => cambiarEsta((x) => { x.activa = e.target.checked; })} />
      <button
        type="button"
        className={confirmar ? 'peligro' : ''}
        title={confirmar ? 'Pulsa otra vez para borrarla' : 'Quitar'}
        aria-label={`Quitar a ${b.nombre}`}
        onClick={() => { if (confirmar) alQuitar(); else setConfirmar(true); }}
      >
        {confirmar ? '¿Seguro?' : '✕'}
      </button>
    </div>
  );
}
