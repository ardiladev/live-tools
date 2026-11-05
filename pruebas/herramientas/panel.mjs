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
//   node pruebas/herramientas/panel.mjs repertorio --clic "boton:Activar@3" --clic "boton:Hecha y siguiente"
//
// --clic "texto[@n]" pulsa el n-ésimo elemento (1 por defecto) con ese texto; "boton:nombre[@n]",
// el n-ésimo botón con ese nombre exacto (su texto o su aria-label). --escribir "etiqueta=valor"
// llena el campo con esa etiqueta (o aria-label). Se hacen en el orden dado.
// Además del texto, compara los ajustes del widget guardados en "panel-live" (widgets[<vista>])
// y la última configuración subida a Supabase (interceptada), con las horas normalizadas.
// Sale con código 1 si algo difiere o hay errores solo en la versión nueva. Capturas en
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
// --clic "texto": pulsa (en orden) el primer elemento con ese texto antes de comparar
// (p. ej. "Personalizar" para comparar también el desplegable, o el texto de una casilla).
const clics = opcion('--clic');
// --clic y --escribir "etiqueta=valor" (llena el campo con esa etiqueta o aria-label), en el orden dados.
const acciones = args.flatMap((a, i) => (a === '--clic' || a === '--escribir' ? [{ tipo: a, valor: args[i + 1] }] : []));
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
  // Azar con semilla fija (botones de prueba «al azar»): las dos versiones eligen lo mismo.
  // React también usa Math.random al cargar: por eso la semilla se reinicia justo antes de
  // cada prueba (window.__reiniciarAzar), y las dos versiones parten del mismo punto.
  await contexto.addInitScript(() => {
    let semilla = 20261105;
    window.__reiniciarAzar = () => { semilla = 20261105; };
    Math.random = () => {
      semilla = (semilla * 1103515245 + 12345) % 2147483648;
      return semilla / 2147483648;
    };
  });
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
  for (const { tipo, valor } of acciones) {
    if (tipo === '--escribir') {
      const [etiqueta, ...resto] = valor.split('=');
      await pagina.getByLabel(etiqueta, { exact: true }).first().fill(resto.join('='));
    } else {
      const [, boton, nombre, n] = valor.match(/^(boton:)?(.*?)(?:@(\d+))?$/);
      const elementos = boton
        ? pagina.getByRole('button', { name: nombre, exact: true })
        : pagina.getByText(nombre, { exact: false });
      await elementos.nth(Number(n || 1) - 1).click();
    }
    await esperar(400);
  }
  if (acciones.length) await esperar(1500); // lo que se guarda o se sube con espera
  const texto = await pagina.evaluate(() => document.querySelector('main')?.innerText.replace(/\s+/g, ' ').trim() || '');
  const ajustes = await pagina.evaluate((id) => JSON.parse(localStorage.getItem('panel-live') || '{}').widgets?.[id] ?? null, vista);
  const subida = llamadas.filter((l) => l.funcion === 'guardar_widget').at(-1);
  await pagina.screenshot({ path: `${salida}/vista-${version}.png`, fullPage: true });

  const previas = [];
  for (const boton of pruebas) {
    // La semilla se reinicia en el panel y en el iframe de la vista previa (cada uno tiene su azar).
    for (const marco of pagina.frames()) await marco.evaluate(() => window.__reiniciarAzar?.()).catch(() => {});
    await pagina.locator('.pruebas button', { hasText: boton }).first().click();
    await esperar(1500);
    const marco = pagina.frameLocator('.escenario iframe').first();
    const contenido = await marco.locator('body').innerText().catch(() => '');
    previas.push({ boton, texto: contenido.replace(/\s+/g, ' ').trim() });
  }
  if (pruebas.length) await pagina.locator('.escenario').first().screenshot({ path: `${salida}/previa-${version}.png` });
  await contexto.close();
  return { texto, previas, errores, llamadas, ajustes, config: subida ? JSON.parse(subida.cuerpo).p_config : null };
}

/**
 * Para comparar: claves en orden, las horas (Date.now(): _v, ronda…) como "<hora>" y la clave de
 * Euler (k) tapada. `tx: 0` (textura estática apagada, agregada a propósito en la versión nueva) no cuenta.
 */
function normalizar(valor) {
  if (Array.isArray(valor)) return valor.map(normalizar);
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(Object.keys(valor).filter((k) => !(k === 'tx' && valor[k] === 0)).sort()
      .map((k) => [k, k === 'k' ? '<clave>' : normalizar(valor[k])]));
  }
  return typeof valor === 'number' && valor > 1e12 ? '<hora>' : valor;
}

const navegador = await chromium.launch({ channel: 'chrome', headless: true });
const viejo = await correr(navegador, 'legado');
const nuevo = await correr(navegador, 'nuevo');
await navegador.close();

// Agregado a propósito en la versión nueva (casilla de la textura estática en el editor de estilo):
// no cuenta como diferencia.
const TEXTURA = ' TEXTURA Textura estática (cuadros fijos, de prueba) Las placas se vuelven ventanas a un patrón de cuadros morados y rosados que queda quieto aunque el contenido se mueva. Apágala para volver al cristal.';
nuevo.texto = nuevo.texto.split(TEXTURA).join('');

let diferencias = 0;
const informe = [];
const textoIgual = viejo.texto === nuevo.texto;
if (!textoIgual) diferencias++;
informe.push(`■ Texto de la vista: ${textoIgual ? 'IGUAL' : 'DISTINTO'}`);
if (!textoIgual) informe.push(`    legado: ${viejo.texto}\n    nuevo:  ${nuevo.texto}`);
for (const [clave, titulo] of [['ajustes', `Ajustes guardados (panel-live → widgets.${vista})`], ['config', 'Última configuración subida']]) {
  const v = JSON.stringify(normalizar(viejo[clave]));
  const n = JSON.stringify(normalizar(nuevo[clave]));
  if (v !== n) diferencias++;
  informe.push(`■ ${titulo}: ${v === n ? 'IGUAL' : 'DISTINTO'}${viejo[clave] === null && nuevo[clave] === null ? ' (no hay)' : ''}`);
  if (v !== n) informe.push(`    legado: ${v}\n    nuevo:  ${n}`);
}
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
