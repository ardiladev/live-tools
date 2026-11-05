// =============================================================================
// panel/componentes/TarjetaWidget.tsx — La tarjeta estándar de un widget de OBS
//
// Campos propios arriba, fila de URL (Copy URL / Test / Personalizar), estado de los cambios
// en vivo y la VISTA PREVIA: un <iframe> con el widget real en ?fondo=1&prueba=1 (nunca se
// conecta al LIVE) al que se le mandan eventos de prueba por postMessage (mismo origen).
//
//   id            el del widget, ya registrado en sincronizar (de ahí salen config y validar)
//   titulo        texto de la tarjeta · archivo: 'meta.html'
//   campos        lo que va arriba de la URL · personalizar: el desplegable (al final, <EditorEstilo id>)
//   pruebas       [{ texto, evento: (nombre) => eventoNormalizado }]  (la primera es "Test")
//   forma         'vertical' (9:16) | 'horizontal' (16:5) | 'cuadrado' (16:9)
//   ancha         true (por defecto) = ocupa todo el ancho de la rejilla
//   sinRecargar   claves que la vista previa aplica sin reiniciarse (p. ej. ['t', 'ro'], el reloj
//                 de la carrera): se le mandan por mensaje { tipo: 'config' }
//
// La URL para OBS:
//   - con Supabase: #c= lleva solo usuario, clave e identificador → se copia UNA vez y los
//     cambios llegan solos al widget (sincronizar.ts los sube);
//   - sin Supabase: #c= lleva toda la configuración → hay que copiarla tras cada cambio.
// (Port de tarjetaWidget, legado/js/panel/ui.js.)
// =============================================================================

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { codificar } from '../../nucleo/configUrl';
import { nubeActiva } from '../../nucleo/nube';
import type { EventoLive } from '../../tipos/eventos';
import type { EstadoPanel } from '../../tipos/panel';
import type { ConfigWidget, FormaVistaPrevia } from '../../tipos/widgets';
import { asegurarIdNube, idNubeDe, obtener, usarAlmacen } from '../estado/almacen';
import { configDe, subir, useEstadoNube, validarDe } from '../estado/sincronizar';
import { Aviso, Icono, Nota, Tarjeta, useAviso } from './ui';

const RETRASO_VISTA_PREVIA_MS = 400; // no reiniciar la vista previa en cada tecla
const TEXTO_NUBE = 'Cambios en vivo: copia esta URL una sola vez; lo que edites aquí llega solo al widget en OBS.';

export interface PruebaWidget {
  texto: string;
  evento: (nombre: string) => EventoLive;
}

export interface PropsTarjetaWidget {
  id: string;
  titulo: string;
  archivo: string;
  campos?: ReactNode;
  personalizar?: ReactNode;
  pruebas?: PruebaWidget[];
  forma?: FormaVistaPrevia;
  ancha?: boolean;
  sinRecargar?: readonly string[];
}

/** La URL del widget para OBS (con el identificador o con toda la configuración). */
export function urlObs(archivo: string, id: string, estado: EstadoPanel, config: ConfigWidget): string {
  const destino = new URL(archivo, location.href);
  const { usuario, clave } = estado.conexion;
  const conexion = { u: usuario.replace(/^@/, '').trim(), k: clave.trim() };
  const datos = nubeActiva() ? { ...conexion, w: idNubeDe(estado, id) } : { ...conexion, ...config };
  destino.hash = `c=${codificar(datos)}`;
  return destino.href;
}

/** La URL de la vista previa: el widget en modo prueba, con toda la configuración. */
export function urlPrevia(archivo: string, config: ConfigWidget): string {
  const destino = new URL(archivo, location.href);
  destino.search = String(new URLSearchParams({ fondo: '1', prueba: '1' }));
  destino.hash = `c=${codificar(config)}`;
  return destino.href;
}

export function TarjetaWidget({
  id, titulo, archivo, campos, personalizar, pruebas = [], forma = 'vertical', ancha = true, sinRecargar = [],
}: PropsTarjetaWidget) {
  const estado = usarAlmacen((e) => e);
  const config = useMemo(() => configDe(id, estado), [id, estado]);
  const textoConfig = JSON.stringify(config);
  const url = urlObs(archivo, id, estado, config);
  const nube = useEstadoNube(id);
  const [aviso, avisar] = useAviso();
  const [abierto, setAbierto] = useState(false);
  const [nombrePrueba, setNombrePrueba] = useState('Valentina');
  const [estadoPrevia, setEstadoPrevia] = useState({ ok: false, mensaje: 'Cargando…' });
  const [src, setSrc] = useState('');
  const iframe = useRef<HTMLIFrameElement>(null);
  const campoUrl = useRef<HTMLInputElement>(null);
  const ultimaPrevia = useRef('');
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const configActual = useRef(config);
  configActual.current = config;

  // Con cambios en vivo, el widget tiene un identificador fijo (va en su URL): se crea al mostrarla.
  useEffect(() => { if (nubeActiva()) asegurarIdNube(id); }, [id]);

  // ---------- Vista previa ----------
  // Un cambio de estilo se le pasa al instante, sin recargarla (useWidget lo aplica); las claves
  // `sinRecargar` van en { tipo: 'config' }; el resto de la configuración sí la reinicia.
  useEffect(() => {
    const ventana = iframe.current?.contentWindow;
    const { est, ...resto } = config;
    ventana?.postMessage({ tipo: 'tema', est }, location.origin);
    if (sinRecargar.length) ventana?.postMessage({ tipo: 'config', config }, location.origin);
    for (const clave of sinRecargar) delete (resto as Record<string, unknown>)[clave];
    const clave = JSON.stringify(resto);
    if (clave === ultimaPrevia.current) return;
    ultimaPrevia.current = clave;
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setSrc(urlPrevia(archivo, configActual.current)), RETRASO_VISTA_PREVIA_MS);
  }, [textoConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearTimeout(temporizador.current), []);

  // Estado que reporta el widget de la vista previa (useWidget → avisarPadre).
  useEffect(() => {
    const alMensaje = (ev: MessageEvent): void => {
      const datos = ev.data as { tipo?: string; ok?: boolean; mensaje?: string } | null;
      if (ev.origin !== location.origin || ev.source !== iframe.current?.contentWindow || datos?.tipo !== 'estado') return;
      setEstadoPrevia({ ok: Boolean(datos.ok), mensaje: String(datos.mensaje || '') });
    };
    addEventListener('message', alMensaje);
    return () => removeEventListener('message', alMensaje);
  }, []);

  function probar(prueba: PruebaWidget): void {
    const evento = prueba.evento(nombrePrueba || 'Espectador');
    iframe.current?.contentWindow?.postMessage({ tipo: 'simular', evento }, location.origin);
  }

  // ---------- Copiar la URL ----------
  async function copiar(): Promise<void> {
    const { usuario, clave } = obtener().conexion;
    const problema = !usuario.trim() || !clave.trim()
      ? 'Falta el usuario o la clave de Euler Stream: complétalos en Ajustes → Conexión.'
      : validarDe(id);
    if (problema) {
      avisar(problema, { error: true });
      return;
    }
    // Con cambios en vivo, el widget lee su configuración de Supabase: tiene que estar guardada.
    if (nubeActiva() && !(await subir(id))) {
      avisar('No se pudo guardar la configuración en Supabase. Revisa tu conexión e inténtalo de nuevo.', { error: true });
      return;
    }
    const estadoAhora = obtener();
    const texto = urlObs(archivo, id, estadoAhora, configDe(id, estadoAhora));
    try {
      await navigator.clipboard.writeText(texto);
      avisar('URL copiada. Pégala en la fuente de navegador.');
    } catch {
      campoUrl.current?.select();
      avisar('Selecciona la URL y cópiala con Ctrl+C.');
    }
  }

  return (
    <Tarjeta titulo={titulo} ancha={ancha}>
      {campos ? <div className="campos">{campos}</div> : null}
      <div className="fila-url">
        <input ref={campoUrl} readOnly aria-label={`URL de ${titulo}`} value={url} />
        <button onClick={() => { void copiar(); }}><Icono nombre="enlace" />Copy URL</button>
        <button onClick={() => { if (pruebas[0]) probar(pruebas[0]); }} title="Lanza una prueba en la vista previa">
          <Icono nombre="flecha" />Test
        </button>
        <button aria-expanded={abierto} onClick={() => setAbierto((a) => !a)}><Icono nombre="engrane" />Personalizar</button>
      </div>
      <div className="opciones" hidden={!abierto}>{personalizar}</div>
      <div className={`estado-nube ${nube.tipo}`} role="status" hidden={!nubeActiva()}>{nube.mensaje || TEXTO_NUBE}</div>
      <Aviso aviso={aviso} />
      <div className={`escenario ${forma}`}>
        <iframe ref={iframe} title={`Vista previa de ${titulo}`} src={src || undefined} />
        <div className="pruebas">
          <div className="estado">
            <span className={estadoPrevia.ok ? 'punto ok' : 'punto'} />
            <span>{estadoPrevia.mensaje}</span>
          </div>
          <label>
            Nombre para las pruebas
            <input value={nombrePrueba} aria-label="Nombre para las pruebas" onChange={(e) => setNombrePrueba(e.target.value)} />
          </label>
          <div className="fila">
            {pruebas.map((p, i) => (
              <button key={p.texto} className={i === 0 ? 'principal' : ''} onClick={() => probar(p)}>{p.texto}</button>
            ))}
          </div>
          <Nota>La vista previa nunca se conecta al LIVE: solo muestra pruebas. El widget real es el que pegas en OBS.</Nota>
        </div>
      </div>
    </Tarjeta>
  );
}
