// =============================================================================
// vistas/historial/datos.ts — Cuentas del historial de las bailarinas (funciones puras)
//
// Recibe las filas que devuelve Supabase (leer_registro: una fila por regalo y por bailarina)
// y arma lo que muestra la vista y lo que va al Excel: el total de cada bailarina, quién la
// apoyó, el resumen por LIVE y el detalle.
// Secciones: 1. Filas · 2. Totales · 3. Apoyos · 4. Excel
// =============================================================================

import type { FilaRegistroLeida, SesionRegistro } from '../../../nucleo/nube';
import type { Hoja } from '../../xlsx';


// -----------------------------------------------------------------------------
// 1. Filas
// -----------------------------------------------------------------------------

export type Origen = 'activador' | 'equipo' | 'apoyo';

export interface FilaHistorial {
  id: string;
  sesion: string;
  bailarina: string;
  /** Nombre de la bailarina cuando se anotó. */
  nombre: string;
  usuario: string;
  uid: string;
  giftId: string;
  regalo: string;
  cantidad: number;
  /** Monedas para esta bailarina (su parte). */
  monedas: number;
  /** Monedas del regalo completo. */
  total: number;
  partes: number;
  origen: Origen;
  hora: number;
}

export const deLeida = (f: FilaRegistroLeida): FilaHistorial => ({
  id: String(f[0]), sesion: String(f[1]), bailarina: String(f[2]), nombre: String(f[3] || ''),
  usuario: String(f[4] || ''), uid: String(f[5] || ''), giftId: String(f[6] || ''), regalo: String(f[7] || ''),
  cantidad: Number(f[8]) || 0, monedas: Number(f[9]) || 0, total: Number(f[10]) || 0,
  partes: Number(f[11]) || 1, origen: (['activador', 'equipo', 'apoyo'].includes(f[12]) ? f[12] : 'apoyo') as Origen,
  hora: Number(f[13]) || 0,
});

/** Una persona: por su cuenta de TikTok si se sabe; si no, por su apodo. */
export const personaDe = (f: Pick<FilaHistorial, 'uid' | 'usuario'>): string =>
  (f.uid ? `u:${f.uid}` : `n:${f.usuario.trim().toLowerCase()}`);

/** Redondea a centésimas (las partes de un reparto tienen hasta 4 decimales). */
export const centesimas = (n: number): number => Math.round(n * 100) / 100;

export const TEXTO_ORIGEN: Record<Origen, string> = {
  activador: 'Su activador',
  equipo: 'Regalo del equipo',
  apoyo: 'Ya la había activado',
};


// -----------------------------------------------------------------------------
// 2. Totales por bailarina
// -----------------------------------------------------------------------------

export interface TotalBailarina {
  id: string;
  nombre: string;
  monedas: number;
  /** Regalos (cantidad: un combo de 10 rosas son 10). */
  regalos: number;
  /** Personas distintas que le regalaron. */
  personas: number;
  /** Veces que la activaron (su activador o el regalo de su equipo). */
  activaciones: number;
}

/**
 * El total de cada bailarina, de mayor a menor. `nombreActual(id)` da el nombre que tiene hoy
 * (si ya no existe, se usa el de la última fila).
 */
export function totales(filas: readonly FilaHistorial[], nombreActual: (id: string) => string | undefined = () => undefined): TotalBailarina[] {
  const mapa = new Map<string, TotalBailarina & { gente: Set<string> }>();
  for (const f of filas) {
    let t = mapa.get(f.bailarina);
    if (!t) {
      t = { id: f.bailarina, nombre: f.nombre, monedas: 0, regalos: 0, personas: 0, activaciones: 0, gente: new Set() };
      mapa.set(f.bailarina, t);
    }
    t.nombre = f.nombre || t.nombre;
    t.monedas += f.monedas;
    t.regalos += f.cantidad;
    t.gente.add(personaDe(f));
    if (f.origen !== 'apoyo') t.activaciones++;
  }
  return [...mapa.values()]
    .map(({ gente, ...t }) => ({ ...t, nombre: nombreActual(t.id) || t.nombre || t.id, monedas: centesimas(t.monedas), personas: gente.size }))
    .sort((a, b) => b.monedas - a.monedas || a.nombre.localeCompare(b.nombre));
}


// -----------------------------------------------------------------------------
// 3. Quién apoyó a cada bailarina
// -----------------------------------------------------------------------------

export interface Apoyo {
  persona: string;
  /** El último apodo con que se le vio. */
  usuario: string;
  monedas: number;
  regalos: number;
}

/** Quiénes le regalaron a la bailarina `id` (o a todas, sin `id`), de mayor a menor. */
export function apoyos(filas: readonly FilaHistorial[], id?: string): Apoyo[] {
  const mapa = new Map<string, Apoyo>();
  for (const f of filas) {
    if (id && f.bailarina !== id) continue;
    const persona = personaDe(f);
    const a = mapa.get(persona) || { persona, usuario: f.usuario, monedas: 0, regalos: 0 };
    a.usuario = f.usuario || a.usuario;
    a.monedas += f.monedas;
    a.regalos += f.cantidad;
    mapa.set(persona, a);
  }
  return [...mapa.values()]
    .map((a) => ({ ...a, monedas: centesimas(a.monedas) }))
    .sort((a, b) => b.monedas - a.monedas || a.usuario.localeCompare(b.usuario));
}


// -----------------------------------------------------------------------------
// 4. Excel
// -----------------------------------------------------------------------------

export interface OpcionesExcel {
  sesiones: readonly SesionRegistro[];
  nombreActual?: (id: string) => string | undefined;
  /** Nombre de un regalo por su ID (el del Buscador de regalos), o ''. */
  nombreRegalo?: (giftId: string) => string;
}

const formatoLive = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** "LIVE del 24/11/2026, 08:05 p. m." para cada sesión. */
export function etiquetasLive(sesiones: readonly SesionRegistro[]): Map<string, string> {
  return new Map(sesiones.map((s) => [s.sesion, `LIVE del ${formatoLive.format(new Date(Number(s.desde) || 0))}`]));
}

/** Las hojas del Excel: Resumen, Por LIVE, Apoyos y Detalle. */
export function hojasExcel(filas: readonly FilaHistorial[], { sesiones, nombreActual = () => undefined, nombreRegalo = () => '' }: OpcionesExcel): Hoja[] {
  const lives = etiquetasLive(sesiones);
  const nombre = (f: FilaHistorial): string => nombreActual(f.bailarina) || f.nombre || f.bailarina;
  const regalo = (f: FilaHistorial): string => nombreRegalo(f.giftId) || f.regalo || (f.giftId ? `Regalo ${f.giftId}` : '');
  const resumen = totales(filas, nombreActual);

  const porLive: (string | number)[][] = [];
  for (const s of sesiones) {
    const deEsta = filas.filter((f) => f.sesion === s.sesion);
    for (const t of totales(deEsta, nombreActual)) porLive.push([lives.get(s.sesion) || s.sesion, t.nombre, t.monedas, t.regalos, t.personas]);
  }

  const apoyosPorBailarina = resumen.flatMap((t) =>
    apoyos(filas, t.id).map((a): (string | number)[] => [t.nombre, a.usuario, a.monedas, a.regalos]));

  return [
    {
      nombre: 'Resumen',
      columnas: [
        { titulo: 'Bailarina', ancho: 22 }, { titulo: 'Monedas', formato: 'decimal', ancho: 14 },
        { titulo: 'Regalos', formato: 'entero', ancho: 11 }, { titulo: 'Personas que la apoyaron', formato: 'entero', ancho: 24 },
        { titulo: 'Activaciones', formato: 'entero', ancho: 13 },
      ],
      filas: resumen.map((t) => [t.nombre, t.monedas, t.regalos, t.personas, t.activaciones]),
    },
    {
      nombre: 'Por LIVE',
      columnas: [
        { titulo: 'LIVE', ancho: 28 }, { titulo: 'Bailarina', ancho: 22 }, { titulo: 'Monedas', formato: 'decimal', ancho: 14 },
        { titulo: 'Regalos', formato: 'entero', ancho: 11 }, { titulo: 'Personas', formato: 'entero', ancho: 11 },
      ],
      filas: porLive,
    },
    {
      nombre: 'Apoyos',
      columnas: [
        { titulo: 'Bailarina', ancho: 22 }, { titulo: 'Persona', ancho: 26 },
        { titulo: 'Monedas', formato: 'decimal', ancho: 14 }, { titulo: 'Regalos', formato: 'entero', ancho: 11 },
      ],
      filas: apoyosPorBailarina,
    },
    {
      nombre: 'Detalle',
      columnas: [
        { titulo: 'Fecha y hora', formato: 'fecha', ancho: 20 }, { titulo: 'LIVE', ancho: 28 }, { titulo: 'Bailarina', ancho: 22 },
        { titulo: 'Persona', ancho: 26 }, { titulo: 'Regalo', ancho: 20 }, { titulo: 'ID del regalo', ancho: 13 },
        { titulo: 'Cantidad', formato: 'entero', ancho: 10 }, { titulo: 'Monedas del regalo', formato: 'decimal', ancho: 18 },
        { titulo: 'Repartido entre', formato: 'entero', ancho: 15 }, { titulo: 'Monedas para ella', formato: 'decimal', ancho: 18 },
        { titulo: 'Cómo le llegó', ancho: 22 },
      ],
      filas: filas.map((f) => [
        new Date(f.hora), lives.get(f.sesion) || f.sesion, nombre(f), f.usuario, regalo(f), f.giftId,
        f.cantidad, f.total, f.partes, f.monedas, TEXTO_ORIGEN[f.origen],
      ]),
    },
  ];
}
