// =============================================================================
// pruebas/herramientas/panel.mjs — Compara una vista del panel viejo (legado/) con la nueva
//
// Abre las dos versiones del panel en la misma vista (#/id), con el MISMO estado guardado
// ("panel-live", opcional) y Supabase interceptado (no se crean filas en la base real), y
// compara el texto del contenido. Opcionalmente pulsa botones de prueba y compara lo que
// muestra la vista previa (el iframe del widget).
//
// Requisitos: Chrome; legado en http://localhost:8080 (npm run legado) y la nueva en
// http://localhost:5173 (npm run dev).
//
//   node pruebas/herramientas/panel.mjs carrera
//   node pruebas/herramientas/panel.mjs carrera --estado pruebas/panel/estado.json --probar "Regalo al azar" --probar "Combo ×10 al azar"
//
// Sale con código 1 si el texto difiere o hay errores solo en la versión nueva. Capturas en
// pruebas/salida/panel-<vista>/.
// =============================================================================

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const VERSIONES = {
  legado: process.env.URL_LEGADO || 'http://localhost:8080/index.html',
  nuevo: process.env.URL_NUEVO || 'http://localhost:5173/',
};

const args = process.argv.slice(2);
const vista = args[0];
if (!vista) {
  console.error('Uso: node pruebas/herramientas/panel.mjs <id-de-vista> [--estado archivo.json] [--probar "botón"]…');
  process.exit(2);
}
const opcion = (nombre) => args.flatMap((a, i) => (a === nombre ? [args[i + 1]] : []));
const estado = opcion('--estado')[0] ? readFileSync(opcion('--estado')[0], 'utf8') : null;
const pruebas = opcion('--probar');
const salida = `pruebas/salida/panel-${vista}`;
mkdirSync(salida, { recursive: true });

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function correr(navegador, version) {
  const contexto = await navegador.newContext({ viewport: { width: 1440, height: 1000 } });
  if (estado) {
    await contexto.addInitScript((datos) => {
      if (!sessionStorage.getItem('sembrado')) {
        localStorage.setItem('panel-live', datos);
        sessionStorage.setItem('sembrado', '1');
      }
    }, estado);
  }
  // Supabase: se responde "guardado" sin tocar la base real.
  const llamadas = [];
  await contexto.route('**/rest/v1/rpc/**', (ruta) => {
    llamadas.push({ funcion: ruta.request().url().split('/rpc/')[1], hora: Date.now(), cuerpo: ruta.request().postData() });
    return ruta.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
  });
  await contexto.route('**/realtime/**', (ruta) => ruta.abort());
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on('pageerror', (e) => errores.push(String(e)));
  pagina.on('console', (m) => { if (m.type() === 'error' && !/realtime|websocket|ERR_FAILED|404/i.test(m.text())) errores.push(m.text()); });

  await pagina.goto(`${VERSIONES[version]}#/${vista}`, { waitUntil: 'load' });
  await esperar(2500); // la vista previa carga a los 400 ms
  const texto = await pagina.evaluate(() => document.querySelector('main')?.innerText.replace(/\s+/g, ' ').trim() || '');
  await pagina.screenshot({ path: `${salida}/vista-${version}.png`, fullPage: true });

  const previas = [];
  for (const boton of pruebas) {
    await pagina.locator('.pruebas button', { hasText: boton }).first().click();
    await esperar(1500);
    const marco = pagina.frameLocator('.escenario iframe').first();
    const contenido = await marco.locator('body').innerText().catch(() => '');
    previas.push({ boton, texto: contenido.replace(/\s+/g, ' ').trim() });
  }
  if (pruebas.length) await pagina.locator('.escenario').first().screenshot({ path: `${salida}/previa-${version}.png` });
  await contexto.close();
  return { texto, previas, errores, llamadas };
}

const navegador = await chromium.launch({ channel: 'chrome', headless: true });
const viejo = await correr(navegador, 'legado');
const nuevo = await correr(navegador, 'nuevo');
await navegador.close();

let diferencias = 0;
const informe = [];
const textoIgual = viejo.texto === nuevo.texto;
if (!textoIgual) diferencias++;
informe.push(`■ Texto de la vista: ${textoIgual ? 'IGUAL' : 'DISTINTO'}`);
if (!textoIgual) informe.push(`    legado: ${viejo.texto}\n    nuevo:  ${nuevo.texto}`);
viejo.previas.forEach((p, i) => {
  const n = nuevo.previas[i];
  const igual = p.texto === n?.texto;
  if (!igual) diferencias++;
  informe.push(`■ Vista previa tras «${p.boton}»: ${igual ? 'IGUAL' : 'DISTINTO'}`);
  if (!igual) informe.push(`    legado: ${p.texto}\n    nuevo:  ${n?.texto}`);
});
const erroresNuevos = nuevo.errores.filter((e) => !viejo.errores.includes(e));
if (erroresNuevos.length) { diferencias++; informe.push(`Errores SOLO en la versión nueva: ${erroresNuevos.join(' | ')}`); }
informe.push(`Llamadas a Supabase (interceptadas): legado ${viejo.llamadas.map((l) => l.funcion).join(', ') || '—'} · nuevo ${nuevo.llamadas.map((l) => l.funcion).join(', ') || '—'}`);
informe.push(`Capturas: ${salida}/vista-legado.png · ${salida}/vista-nuevo.png`);
const texto = informe.join('\n');
writeFileSync(`${salida}/informe.txt`, texto);
console.log(texto);
console.log(diferencias ? `\n✗ ${diferencias} diferencia(s)` : '\n✓ Sin diferencias');
process.exit(diferencias ? 1 : 0);
