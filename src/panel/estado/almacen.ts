// =============================================================================
// panel/estado/almacen.ts — Todo lo que el panel recuerda, guardado en el navegador
//
// Gestor de estado del panel: Zustand (suscripciones y hook) + Immer (cambios escritos como
// si se modificara el objeto, pero que producen un estado nuevo e inmutable para React).
// Se guarda en localStorage con la MISMA clave y la MISMA forma de siempre ("panel-live", ver
// src/tipos/panel.ts): así el panel nuevo abre con todo lo que ya estaba guardado (conexión,
// catálogo de regalos, ajustes de cada widget, secreto e identificadores de Supabase).
//
// Reglas para usarlo desde React:
//   - Leer:     usarAlmacen((e) => e.conexion)  ·  useAjustesWidget(id, POR_DEFECTO)
//   - Cambiar:  cambiar((e) => { e.conexion.usuario = 'x'; })  (guarda y avisa al instante)
//   - Las funciones que arman la configuración de un widget (vistas/<x>/config.ts) deben ser
//     PURAS: leen el estado que reciben y no escriben. Por eso idNubeDe() solo lee; los ids y
//     el secreto se crean con asegurarIdNube() / asegurarSecreto() (en eventos o efectos).
//
// Secciones: 1. Estado y guardado · 2. Varias pestañas · 3. Conexión, menú y widgets
//            4. Catálogo de regalos · 5. Cambios de código · 6. Preferencias y estilo
//            7. Cambios en vivo (ids y secreto)
// =============================================================================

import { produce, type Draft } from 'immer';
import { useCallback, useEffect, useMemo } from 'react';
import { create } from 'zustand';
import { idAleatorio } from '../../nucleo/nube';
import { normalizarTema } from '../../nucleo/tema';
import type { AjustesWidget, EstadoPanel, Regalo } from '../../tipos/panel';
import type { Tema } from '../../tipos/tema';

export const CLAVE = 'panel-live';
/** Las ruletas del panel (ids de widget) y su nombre para los avisos. Ver vistas/ruleta. */
export const RULETAS = { ruleta: 'Ruleta de regalos', 'ruleta-premium': 'Ruleta premium' } as const;
const CLAVE_VIEJA = 'ruleta-generador'; // la primera versión del generador guardaba aquí
const RETRASO_GUARDADO_MS = 1000;       // los regalos se guardan agrupados, no uno por uno
const MAX_AVISOS = 20;


// -----------------------------------------------------------------------------
// 1. Estado y guardado
// -----------------------------------------------------------------------------

export const estadoInicial = (): EstadoPanel => ({
  conexion: { usuario: '', clave: '' },
  widgets: {},
  menuCerrados: [],
  preferencias: { autoConectar: false },
  tema: normalizarTema(),
  temasPropios: {},
  regalos: {},
  sugerencias: [],
  distintos: [],
  cambiosDeCodigo: [],
  nube: { secreto: '', ids: {} },
});

/** El estado del panel (hook de React y, fuera de React, usarAlmacen.getState()). */
export const usarAlmacen = create<EstadoPanel>()(() => estadoInicial());

/** El estado actual, fuera de React. */
export const obtener = (): EstadoPanel => usarAlmacen.getState();

function leer(clave: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(clave) || 'null');
  } catch {
    return null; // almacenamiento bloqueado o dato dañado
  }
}

/** Guarda todo en el navegador. */
function guardar(): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(obtener()));
  } catch {
    // Sin almacenamiento (modo privado, cuota llena…): el panel sigue funcionando en memoria.
  }
}

let guardadoPendiente: ReturnType<typeof setTimeout> | undefined;
function guardarEnUnMomento(): void {
  clearTimeout(guardadoPendiente);
  guardadoPendiente = setTimeout(guardar, RETRASO_GUARDADO_MS);
}

/**
 * Cambia el estado (con Immer: se escribe como si se modificara `e`) y lo guarda.
 * `agrupar`: guarda dentro de un momento (los regalos que llegan seguidos se guardan juntos).
 */
export function cambiar(receta: (e: Draft<EstadoPanel>) => void, { agrupar = false }: { agrupar?: boolean } = {}): void {
  usarAlmacen.setState((e) => produce(e, receta), true);
  if (agrupar) guardarEnUnMomento();
  else guardar();
}

/** Carga lo guardado. La primera vez, migra los datos del generador anterior si existen. */
export function cargar(): void {
  const guardado = leer(CLAVE);
  if (guardado && typeof guardado === 'object') {
    usarAlmacen.setState({ ...estadoInicial(), ...(guardado as Partial<EstadoPanel>) }, true);
    return;
  }
  const viejo = leer(CLAVE_VIEJA) as Record<string, unknown> | null;
  if (!viejo) return;
  cambiar((e) => {
    e.conexion = { usuario: String(viejo.usuario || ''), clave: String(viejo.clave || '') };
    e.widgets.ruleta = {
      giftId: viejo.giftId, regalo: viejo.regalo, gpr: viejo.gpr, max: viejo.max,
      ocultar: viejo.ocultar, sonido: viejo.sonido, premios: viejo.premios,
    };
  });
}


// -----------------------------------------------------------------------------
// 2. Varias pestañas del panel
// -----------------------------------------------------------------------------
// Cada pestaña tiene su copia en memoria y guarda todo de una vez: sin esto, la última pestaña
// en guardar borraría lo de las demás (por ejemplo, el identificador recién creado de un
// widget, y el widget en OBS dejaría de recibir cambios). Cuando otra pestaña guarda, se toma
// lo suyo; los identificadores se SUMAN (nunca se pierde uno que ya esté en una URL de OBS).

export function tomarDeOtraPestana(otro: Partial<EstadoPanel>): void {
  const { conexion: con, preferencias: pref, widgets, nube, ...resto } = otro;
  usarAlmacen.setState((e) => produce(e, (b) => {
    Object.assign(b, resto);
    if (con) b.conexion = con;
    if (pref) b.preferencias = pref;
    for (const [id, config] of Object.entries(widgets || {})) b.widgets[id] = config;
    b.nube = {
      secreto: nube?.secreto || b.nube.secreto,
      ids: { ...b.nube.ids, ...nube?.ids },
    };
  }), true);
}

if (typeof window !== 'undefined') {
  addEventListener('storage', (ev) => {
    if (ev.key !== CLAVE || ev.storageArea !== localStorage) return;
    const otro = leer(CLAVE);
    if (otro && typeof otro === 'object') tomarDeOtraPestana(otro as Partial<EstadoPanel>);
  });
}


// -----------------------------------------------------------------------------
// 3. Conexión, menú y ajustes de cada widget
// -----------------------------------------------------------------------------

export function cambiarConexion(cambios: Partial<EstadoPanel['conexion']>): void {
  cambiar((e) => { Object.assign(e.conexion, cambios); });
}

/** Abre o cierra un grupo del menú (se recuerda). */
export function cambiarGrupoMenu(id: string, abierto: boolean): void {
  cambiar((e) => {
    e.menuCerrados = e.menuCerrados.filter((x) => x !== id);
    if (!abierto) e.menuCerrados.push(id);
  });
}

/**
 * Unos ajustes guardados completados con sus valores por defecto (sin escribir). Si no falta
 * nada, devuelve el MISMO objeto (así React no vuelve a pintar sin necesidad).
 */
export function completarAjustes<T extends AjustesWidget>(guardados: AjustesWidget | undefined, porDefecto: T): T {
  const actual = (guardados || {}) as Partial<T>;
  let completo: T | null = null;
  for (const [clave, valor] of Object.entries(porDefecto)) {
    const v = actual[clave as keyof T];
    if (v === undefined || v === null) {
      completo ??= { ...actual } as T;
      (completo as Record<string, unknown>)[clave] = structuredClone(valor);
    }
  }
  return completo ?? (actual as T);
}

/** Los ajustes de un widget, completados con sus valores por defecto (sin escribir). */
export const ajustesDe = <T extends AjustesWidget>(estado: EstadoPanel, id: string, porDefecto: T): T =>
  completarAjustes(estado.widgets[id], porDefecto);

function completarBorrador<T extends AjustesWidget>(e: Draft<EstadoPanel>, id: string, porDefecto: T): Draft<T> {
  const actual = (e.widgets[id] ??= {}) as Record<string, unknown>;
  for (const [clave, valor] of Object.entries(porDefecto)) {
    if (actual[clave] === undefined || actual[clave] === null) actual[clave] = structuredClone(valor);
  }
  return actual as Draft<T>;
}

/** Deja guardados los valores por defecto que falten (como hacía el panel al abrir una vista). */
export function asegurarWidget<T extends AjustesWidget>(id: string, porDefecto: T): void {
  const estado = obtener();
  if (ajustesDe(estado, id, porDefecto) === estado.widgets[id]) return; // ya estaba completo
  cambiar((e) => { completarBorrador(e, id, porDefecto); });
}

/** Cambia los ajustes de un widget (completados con sus valores por defecto) y los guarda. */
export function cambiarWidget<T extends AjustesWidget>(id: string, porDefecto: T, receta: (ajustes: Draft<T>) => void): void {
  cambiar((e) => { receta(completarBorrador(e, id, porDefecto)); });
}

/**
 * Los ajustes de un widget para una vista y la función para cambiarlos.
 * `porDefecto` debe ser una constante del módulo (no un objeto nuevo en cada render).
 */
export function useAjustesWidget<T extends AjustesWidget>(id: string, porDefecto: T): [T, (receta: (ajustes: Draft<T>) => void) => void] {
  const guardados = usarAlmacen((e) => e.widgets[id]);
  const ajustes = useMemo(() => completarAjustes(guardados, porDefecto), [guardados, porDefecto]);
  useEffect(() => { asegurarWidget(id, porDefecto); }, [id, porDefecto]);
  const cambiarAjustes = useCallback((receta: (ajustes: Draft<T>) => void) => cambiarWidget(id, porDefecto, receta), [id, porDefecto]);
  return [ajustes, cambiarAjustes];
}


// -----------------------------------------------------------------------------
// 4. Catálogo de regalos
// -----------------------------------------------------------------------------

/** El nombre que se muestra: el que puso la persona, o el que mandó TikTok. */
export const nombreRegalo = (r?: Regalo | null): string => r?.nombrePropio || r?.nombre || '';
const mismoNombre = (a?: string, b?: string): boolean => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * El regalo guardado con OTRO código que se llama igual, si existe. Cuenta tanto el nombre
 * propio como el de TikTok: si la persona renombró "Rose" a "Rosa" y llega "Rose" con otro
 * código, se sigue reconociendo como posible cambio de código.
 */
export function buscarPorNombre(regalos: EstadoPanel['regalos'], nombre: string, excepto?: string): Regalo | null {
  return Object.values(regalos).find((r) => r.giftId !== excepto
    && (mismoNombre(nombreRegalo(r), nombre) || mismoNombre(r.nombre, nombre))) || null;
}

/** Agrega o corrige un regalo a mano (por ejemplo, un ID visto en otra página). */
export function anotarRegalo(giftIdPedido: string | number, cambios: Partial<Regalo>): void {
  const giftId = String(giftIdPedido).trim();
  if (!giftId) return;
  cambiar((e) => {
    const r = e.regalos[giftId] || { giftId, veces: 0, primero: Date.now(), ultimo: 0 };
    e.regalos[giftId] = Object.assign(r, cambios);
  });
}

export function quitarRegalo(giftId: string): void {
  cambiar((e) => { delete e.regalos[giftId]; });
}

/**
 * Anota un regalo que llegó del LIVE. Si TikTok mandó su nombre y ya había un regalo con
 * ese nombre bajo OTRO código, puede ser el mismo regalo con código nuevo. Como hay regalos
 * distintos que se llaman igual (dos "Candy Bouquet" de 249 y 349 monedas), solo se reescribe
 * automáticamente si además cuesta lo mismo; si no, se le pregunta a la persona.
 */
export function registrarRegalo(evento: { giftId: string; nombre: string; imagen: string; diamantes: number; cantidad: number }): void {
  const ahora = Date.now();
  cambiar((e) => {
    const r = e.regalos[evento.giftId] || { giftId: evento.giftId, veces: 0, primero: ahora };
    Object.assign(r, {
      nombre: evento.nombre || r.nombre || '',
      imagen: evento.imagen || r.imagen || '',
      diamantes: evento.diamantes || r.diamantes || 0,
      veces: (r.veces || 0) + (evento.cantidad || 1),
      ultimo: ahora,
    });
    e.regalos[evento.giftId] = r;
  }, { agrupar: true });

  const estado = obtener();
  const conOtroCodigo = evento.nombre ? buscarPorNombre(estado.regalos, evento.nombre, evento.giftId) : null;
  if (conOtroCodigo) {
    const r = estado.regalos[evento.giftId];
    const mismoPrecio = Boolean(r?.diamantes && r.diamantes > 0 && r.diamantes === conOtroCodigo.diamantes);
    if (mismoPrecio) {
      cambiarCodigo(conOtroCodigo.giftId, evento.giftId);
      return;
    }
    sugerirCambio(conOtroCodigo.giftId, evento.giftId);
  }
}

/**
 * La persona le puso nombre a un regalo. Si otro regalo ya se llama así, se sugiere que es
 * el mismo con código nuevo (el "nuevo" es el que llegó más recientemente).
 */
export function nombrarRegalo(giftId: string, nombre: string): void {
  anotarRegalo(giftId, { nombrePropio: nombre });
  const estado = obtener();
  const otro = nombre ? buscarPorNombre(estado.regalos, nombre, giftId) : null;
  if (!otro) return;
  const este = estado.regalos[giftId];
  const esteEsMasNuevo = (este?.ultimo || 0) >= (otro.ultimo || 0);
  if (esteEsMasNuevo) sugerirCambio(otro.giftId, giftId);
  else sugerirCambio(giftId, otro.giftId);
}


// -----------------------------------------------------------------------------
// 5. Cambios de código
// -----------------------------------------------------------------------------

const claveDePar = (a: string, b: string): string => [a, b].sort().join('|');

/**
 * Cambia el código de un regalo: el registro de `viejo` pasa a `nuevo`, sumando lo que ya
 * hubiera en `nuevo` y anotando el código anterior. Si alguna ruleta usaba el código viejo,
 * se actualiza y se deja un aviso (con cambios en vivo, sincronizar.ts lo lleva solo a OBS;
 * sin ellos, el aviso pide volver a copiar su URL).
 */
export function cambiarCodigo(viejo: string, nuevo: string): void {
  const estado = obtener();
  const anterior = estado.regalos[viejo];
  if (!anterior || viejo === nuevo) return;
  cambiar((e) => {
    const actual: Partial<Regalo> = e.regalos[nuevo] || {};
    const datosNuevos = Object.fromEntries(Object.entries(actual).filter(([, v]) => v)); // lo recién llegado manda
    e.regalos[nuevo] = {
      ...anterior,
      ...datosNuevos,
      giftId: nuevo,
      nombrePropio: anterior.nombrePropio || actual.nombrePropio || '',
      veces: (anterior.veces || 0) + (actual.veces || 0),
      primero: Math.min(anterior.primero || Date.now(), actual.primero || Date.now()),
      idsAnteriores: [...new Set([...(anterior.idsAnteriores || []), ...(actual.idsAnteriores || []), viejo])],
      cambiado: Date.now(),
    };
    delete e.regalos[viejo];

    const enRuleta: string[] = [];
    for (const [id, titulo] of Object.entries(RULETAS)) {
      const ruleta = e.widgets[id];
      if (ruleta && String(ruleta.giftId) === String(viejo)) {
        ruleta.giftId = nuevo;
        enRuleta.push(titulo);
      }
    }

    e.cambiosDeCodigo = [
      { nombre: nombreRegalo(e.regalos[nuevo]), viejo, nuevo, enRuleta, cuando: Date.now() },
      ...e.cambiosDeCodigo,
    ].slice(0, MAX_AVISOS);
  });
}

/** Deja una pregunta: "¿el regalo `viejo` ahora llega con el código `nuevo`?" */
export function sugerirCambio(viejo: string, nuevo: string): void {
  if (viejo === nuevo || obtener().distintos.includes(claveDePar(viejo, nuevo))) return;
  cambiar((e) => {
    const otras = e.sugerencias.filter((s) => !(s.viejo === viejo && s.nuevo === nuevo));
    e.sugerencias = [{ viejo, nuevo }, ...otras].slice(0, MAX_AVISOS);
  });
}

/** Las preguntas que siguen siendo válidas (los dos regalos existen todavía). */
export const sugerenciasVigentes = (estado: EstadoPanel): EstadoPanel['sugerencias'] =>
  estado.sugerencias.filter((s) => estado.regalos[s.viejo] && estado.regalos[s.nuevo]);

/** Respuesta de la persona: sí es el mismo regalo (se une) o son distintos (no se vuelve a preguntar). */
export function responderSugerencia({ viejo, nuevo }: { viejo: string; nuevo: string }, esElMismo: boolean): void {
  cambiar((e) => { e.sugerencias = e.sugerencias.filter((s) => !(s.viejo === viejo && s.nuevo === nuevo)); });
  if (esElMismo) {
    cambiarCodigo(viejo, nuevo);
    return;
  }
  cambiar((e) => { e.distintos = [...new Set([...e.distintos, claveDePar(viejo, nuevo)])]; });
}

export function olvidarCambiosDeCodigo(): void {
  cambiar((e) => { e.cambiosDeCodigo = []; });
}


// -----------------------------------------------------------------------------
// 6. Preferencias y estilo de los widgets
// -----------------------------------------------------------------------------
// Cada widget tiene su estilo (se edita en su "Personalizar", componentes/EditorEstilo).
// Mientras un widget no se haya personalizado, usa el estilo base.

export function cambiarPreferencias(cambios: Partial<EstadoPanel['preferencias']>): void {
  cambiar((e) => { Object.assign(e.preferencias, cambios); });
}

/** El estilo del widget `id`: el suyo si ya se personalizó, si no el base (siempre completo y válido). */
export function temaDe(estado: EstadoPanel, id: string): Tema {
  return normalizarTema(estado.temasPropios[id] || estado.tema);
}

/** Cambia el estilo del widget `id` (todo o algunas claves) y lo guarda: sincronizar.ts lo lleva a OBS. */
export function cambiarTema(id: string, cambios: Partial<Tema>): void {
  const tema = normalizarTema({ ...temaDe(obtener(), id), ...cambios });
  cambiar((e) => { e.temasPropios[id] = tema; });
}

/** Copia el estilo del widget `id` en todos los widgets (y lo deja como base). */
export function aplicarTemaATodos(id: string): void {
  const tema = temaDe(obtener(), id);
  cambiar((e) => {
    e.tema = structuredClone(tema);
    e.temasPropios = {};
  });
}


// -----------------------------------------------------------------------------
// 7. Cambios en vivo (Supabase)
// -----------------------------------------------------------------------------
// Cada widget tiene un identificador fijo (va en su URL) y el panel un secreto (no sale de
// este navegador) que Supabase exige para cambiar la configuración. Se crean la primera vez.

/** El identificador del widget `id`, o '' si todavía no tiene (solo lee). */
export const idNubeDe = (estado: EstadoPanel, id: string): string => estado.nube.ids[id] || '';

/** ¿El widget `id` ya tiene identificador? (si no, nunca se mostró su URL). */
export const tieneIdNube = (estado: EstadoPanel, id: string): boolean => Boolean(estado.nube.ids[id]);

/** El identificador fijo del widget `id`; si no tiene, lo crea y lo guarda. */
export function asegurarIdNube(id: string): string {
  const existente = obtener().nube.ids[id];
  if (existente) return existente;
  const nuevo = idAleatorio();
  cambiar((e) => { e.nube.ids[id] = nuevo; });
  return nuevo;
}

/** El secreto de este panel para escribir en Supabase; si no hay, lo crea y lo guarda. */
export function asegurarSecreto(): string {
  const existente = obtener().nube.secreto;
  if (existente) return existente;
  const nuevo = idAleatorio(24);
  cambiar((e) => { e.nube.secreto = nuevo; });
  return nuevo;
}
