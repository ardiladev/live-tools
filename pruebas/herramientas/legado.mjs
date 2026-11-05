// =============================================================================
// pruebas/herramientas/legado.mjs — Dónde está la versión vanilla ORIGINAL (para compararla)
//
// La versión anterior (HTML/CSS/JS sin compilar) ya no vive en el repositorio, pero sigue en el
// historial de git. Las pruebas de paridad la necesitan: si existe legado/, se usa esa carpeta;
// si no, se saca UNA vez del historial (el último commit que la tenía) a pruebas/salida/legado
// (ignorada por git).
//
//   node pruebas/herramientas/legado.mjs      → la extrae (npm run legado:extraer) y muestra la ruta
// =============================================================================

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const EN_EL_REPO = resolve('legado');
const EXTRAIDA = resolve('pruebas/salida/legado');
const MARCA = 'js/comun.js';

/** La carpeta con la versión original, o '' si no está (sin sacarla del historial). */
export function carpetaLegadoSiEsta() {
  if (existsSync(resolve(EN_EL_REPO, MARCA))) return EN_EL_REPO;
  if (existsSync(resolve(EXTRAIDA, MARCA))) return EXTRAIDA;
  return '';
}

/** La carpeta con la versión original; si no está, la saca del historial de git. */
export function carpetaLegado() {
  const ya = carpetaLegadoSiEsta();
  if (ya) return ya;
  // El último commit que tocó legado/js/comun.js es el que quitó la carpeta: su padre la tiene.
  const commit = execSync('git rev-list -1 HEAD -- legado/js/comun.js', { encoding: 'utf8' }).trim();
  if (!commit) throw new Error('No encontré legado/ en el historial de git.');
  mkdirSync(resolve('pruebas/salida'), { recursive: true });
  execSync(`git archive --format=tar ${commit}^ legado | tar -x -C pruebas/salida`, { stdio: 'inherit' });
  if (!existsSync(resolve(EXTRAIDA, MARCA))) throw new Error('No se pudo extraer legado/ del historial.');
  return EXTRAIDA;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  console.log(`Versión original en: ${carpetaLegado()}`);
}
