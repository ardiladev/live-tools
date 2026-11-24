// =============================================================================
// nucleo/fotos.ts — Fotos de las bailarinas (las usan el panel y los widgets de juegos)
//
// Las fotos NO viajan en la configuración de los widgets (pesan demasiado: Supabase admite
// hasta 20.000 bytes por configuración). La configuración lleva solo el id de cada foto (`f`)
// y el widget la busca:
//   1. en la copia de este navegador (localStorage "live-tools:foto:<id>"). El panel la deja
//      ahí al guardar la foto, así la vista previa (mismo sitio) la tiene al instante;
//   2. si no está, en Supabase (leer_fotos), y la deja copiada para la próxima vez.
// El id de una foto cambia cada vez que se cambia la foto: una copia nunca queda vieja.
// =============================================================================

import { leerFotos, nubeActiva } from './nube';

export const CLAVE_FOTO = 'live-tools:foto:';

/** Los ids de foto de una configuración (clave `f`): solo textos con forma de id, hasta 6. */
export const normalizarFotos = (f: unknown): string[] =>
  (Array.isArray(f) ? f.map(String).filter((id) => /^[\w-]{8,64}$/.test(id)).slice(0, 6) : []);

/** La foto guardada en este navegador, o ''. */
export function fotoLocal(id: string): string {
  try {
    return localStorage.getItem(CLAVE_FOTO + id) || '';
  } catch {
    return '';
  }
}

/** Deja una copia de la foto en este navegador (sin almacenamiento, no pasa nada). */
export function guardarFotoLocal(id: string, datos: string): void {
  try {
    localStorage.setItem(CLAVE_FOTO + id, datos);
  } catch {
    // Almacenamiento lleno o bloqueado: se volverá a pedir a Supabase.
  }
}

export function olvidarFotoLocal(id: string): void {
  try {
    localStorage.removeItem(CLAVE_FOTO + id);
  } catch {
    // nada que hacer
  }
}

const pedidas = new Map<string, Promise<string>>(); // una sola petición por foto a la vez

/** Las fotos pedidas { id: datos } (las que no se encuentran no vienen). */
export async function cargarFotos(ids: readonly string[]): Promise<Record<string, string>> {
  const resultado: Record<string, string> = {};
  const faltan: string[] = [];
  for (const id of new Set(ids.filter(Boolean))) {
    const local = fotoLocal(id);
    if (local) resultado[id] = local;
    else faltan.push(id);
  }
  if (!faltan.length || !nubeActiva()) return resultado;

  const nuevas = faltan.filter((id) => !pedidas.has(id));
  if (nuevas.length) {
    const lectura = leerFotos(nuevas).catch(() => ({} as Record<string, string>));
    for (const id of nuevas) {
      pedidas.set(id, lectura.then((todas) => {
        const datos = todas[id] || '';
        if (datos) guardarFotoLocal(id, datos);
        pedidas.delete(id); // si no estaba, se puede volver a pedir más tarde
        return datos;
      }));
    }
  }
  const datos = await Promise.all(faltan.map((id) => pedidas.get(id) ?? Promise.resolve('')));
  faltan.forEach((id, i) => { if (datos[i]) resultado[id] = datos[i]; });
  return resultado;
}
