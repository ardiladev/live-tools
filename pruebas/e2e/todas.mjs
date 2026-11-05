// =============================================================================
// pruebas/e2e/todas.mjs — Toda la paridad de punta a punta: widgets y panel
//
// Corre, uno por uno:
//   1. cada escenario de pruebas/paridad/*.json (los 16 widgets: textos, guardado, clases,
//      capturas) con pruebas/herramientas/paridad.mjs;
//   2. una comprobación por cada vista del panel (las 23) con pruebas/herramientas/panel.mjs:
//      textos, ajustes guardados, configuración subida (Supabase interceptado) y la vista previa
//      tras su primer botón de prueba.
// Compara contra la versión vieja (legado/, npm run legado → :8080). La nueva puede ser el
// servidor de desarrollo (npm run dev → :5173, por defecto) o el build:
//
//   npm run build && node pruebas/herramientas/servir.mjs dist 4173
//   E2E_NUEVO=http://localhost:4173 npm run e2e
//
// Nada toca la base real: Supabase y Euler Stream están interceptados. Sale con 1 si algo difiere.
// =============================================================================

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const nuevo = (process.env.E2E_NUEVO || 'http://localhost:5173').replace(/\/$/, '');
const ESTADO = ['--estado', 'pruebas/panel/estado.json'];

// [vista, primer botón de prueba] (sin botón: solo la vista).
const VISTAS = [
  ['ruleta', 'Probar 1 regalo'], ['ruleta-premium', 'Probar 1 regalo'], ['tragamonedas', 'Probar giro'],
  ['carrera', 'Regalo al azar'], ['marcador', 'Regalo al azar'], ['batalla', 'Regalo al equipo A'],
  ['activacion', 'Unirme al siguiente equipo'], ['cola', 'Reto de prueba'], ['jefe', '+100 likes'],
  ['boveda', 'Regalo de 100'], ['subathon', '+100 likes'], ['extensible', '+100 likes'],
  ['repertorio', 'Regalo de 100'], ['meta-likes', '+50 likes'], ['meta-follows', '+1 seguidor'],
  ['meta-shares', '+1 compartido'], ['meta-monedas', 'Regalo de 100'], ['alertas', 'Regalo'],
  ['destacado', '1. Escribir en el chat'], ['trono', 'Combo ×5 (5 monedas)'],
  ['actividad', null], ['regalos', null], ['conexion', null],
];

function correr(titulo, script, args, env) {
  const r = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env: { ...process.env, ...env } });
  const salida = `${r.stdout || ''}${r.stderr || ''}`.trim();
  const ok = r.status === 0;
  console.log(`${ok ? '✓' : '✗'} ${titulo}`);
  if (!ok) console.log(salida.split('\n').map((l) => `    ${l}`).join('\n'));
  return ok;
}

let fallas = 0;
console.log(`Versión nueva: ${nuevo} · versión vieja: http://localhost:8080\n\nWidgets (pruebas/paridad):`);
for (const archivo of readdirSync('pruebas/paridad').filter((a) => a.endsWith('.json')).sort()) {
  if (!correr(archivo.replace('.json', ''), 'pruebas/herramientas/paridad.mjs', [`pruebas/paridad/${archivo}`], { URL_NUEVO: nuevo })) fallas++;
}

console.log('\nPanel (una comprobación por vista):');
for (const [vista, boton] of VISTAS) {
  const args = [vista, ...ESTADO, '--hora-fija', ...(boton ? ['--probar', boton] : [])];
  if (!correr(vista, 'pruebas/herramientas/panel.mjs', args, { URL_NUEVO: `${nuevo}/index.html` })) fallas++;
}

console.log(fallas ? `\n✗ ${fallas} con diferencias` : '\n✓ Todo igual a la versión vieja');
process.exit(fallas ? 1 : 0);
