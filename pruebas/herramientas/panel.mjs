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
// el n-ésimo botón con ese nombre exacto (su texto o su aria-label). --escribir "etiqueta[@n]=valor"
// llena el n-ésimo campo con esa etiqueta (o aria-label); --elegir "etiqueta[@n]=valor" elige en una
// lista desplegable. --simular '{"tipo":"regalo",…}' mete un
// evento como si viniera del LIVE (la conexión del panel). Se hacen en el orden dado.
// --hora-fija: Date y new Date() devuelven siempre 2026-11-05 12:00 (los temporizadores siguen):
// así la hora de cada evento y las fechas del catálogo no cambian entre corridas.
// --comparar <parte>: compara también esa parte de "panel-live" (p. ej. conexion, preferencias,
// regalos, cambiosDeCodigo, widgets.ruleta); las claves se comparan por su huella, nunca se muestran.
// Además del texto, compara los ajustes del widget guardados en "panel-live" (widgets[<vista>])
// y la última configuración subida a Supabase (interceptada), con las horas normalizadas.
// Sale con código 1 si algo difiere o hay errores solo en la versión nueva. Capturas en
// pruebas/salida/panel-<vista>/.
// =============================================================================

import { createHash } from 'node:crypto';
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
const acciones = args.flatMap((a, i) => (['--clic', '--escribir', '--elegir', '--simular'].includes(a) ? [{ tipo: a, valor: args[i + 1] }] : []));
const horaFija = args.includes('--hora-fija');
const partes = opcion('--comparar');
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
  // Euler Stream: ninguna prueba abre una conexión real (se cierra como "clave inválida", 4401).
  await contexto.routeWebSocket(/eulerstream\.com/, (ws) => ws.close({ code: 4401, reason: 'prueba' }));
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on('pageerror', (e) => errores.push(String(e)));
  pagina.on('console', (m) => { if (m.type() === 'error' && !/realtime|websocket|ERR_FAILED|404/i.test(m.text())) errores.push(m.text()); });
  if (horaFija) await pagina.clock.setFixedTime(new Date('2026-11-05T12:00:00-05:00'));

  await pagina.goto(`${VERSIONES[version]}#/${vista}`, { waitUntil: 'load' });
  await esperar(2500); // la vista previa carga a los 400 ms
  // Un id que no existe hace que el panel muestre la vista inicial (la ruleta) y la comparación
  // "pasaría" sin probar nada: se exige que la vista pedida sea la activa del menú.
  const existe = await pagina.evaluate((id) => Boolean(document.querySelector(`a[aria-current="page"][href="#/${id}"]`)), vista);
  if (!existe) throw new Error(`[${version}] La vista «${vista}» no existe: el panel mostró otra. Revisa el id (#/${vista}).`);
  for (const { tipo, valor } of acciones) {
    if (tipo === '--simular') {
      // La versión nueva lo expone en liveTools; en la vieja, el módulo envivo.js es el mismo que usa el panel.
      await pagina.evaluate(async (evento) => {
        if (window.liveTools?.simular) window.liveTools.simular(evento);
        else (await import('/js/panel/envivo.js')).simular(evento);
      }, JSON.parse(valor));
    } else if (tipo === '--escribir' || tipo === '--elegir') {
      const [campo, ...resto] = valor.split('=');
      const [, etiqueta, n] = campo.match(/^(.*?)(?:@(\d+))?$/);
      // Una lista dentro de su etiqueta se llama "etiqueta + opción elegida": ahí no se pide exacto.
      const control = pagina.getByLabel(etiqueta, { exact: tipo === '--escribir' }).nth(Number(n || 1) - 1);
      if (tipo === '--elegir') await control.selectOption(resto.join('='));
      else await control.fill(resto.join('='));
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
  // El original escribe los valores por defecto en memoria al pintar una vista y los guarda en la
  // siguiente escritura: se le pide guardar ya, para comparar lo que de verdad tiene.
  if (version === 'legado') await pagina.evaluate(async () => { (await import('/js/panel/almacen.js')).guardar(); });
  const { ajustes, idNube, otras } = await pagina.evaluate(([id, nombres]) => {
    const guardado = JSON.parse(localStorage.getItem('panel-live') || '{}');
    return {
      ajustes: guardado.widgets?.[id] ?? null,
      idNube: guardado.nube?.ids?.[id] ?? '',
      // "widgets.ruleta-premium": se puede pedir una parte de una parte.
      otras: Object.fromEntries(nombres.map((n) => [n, n.split('.').reduce((o, k) => o?.[k], guardado) ?? null])),
    };
  }, [vista, partes]);
  // La última subida DEL WIDGET DE ESTA VISTA (su id de nube): otras pueden subir en otro orden.
  const subida = llamadas.filter((l) => l.funcion === 'guardar_widget' && JSON.parse(l.cuerpo || '{}').p_id === idNube).at(-1);
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
  return { texto, previas, errores, llamadas, ajustes, otras, config: subida ? JSON.parse(subida.cuerpo).p_config : null };
}

/** Una clave nunca se muestra: se compara por su huella (sha256, 8 caracteres). */
const tapar = (v) => (v ? `<huella ${createHash('sha256').update(String(v)).digest('hex').slice(0, 8)}>` : '');

/**
 * Para comparar: claves en orden, las horas (Date.now(): _v, ronda…) como "<hora>", las claves por su
 * huella, los ids aleatorios de la cola (cl, rc) como "<id de nube>". `tx: 0` (textura estática apagada,
 * agregada a propósito en la versión nueva) no cuenta.
 */
function normalizar(valor) {
  if (Array.isArray(valor)) return valor.map(normalizar);
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(Object.keys(valor).filter((k) => !(k === 'tx' && valor[k] === 0)).sort()
      .map((k) => [k, ['k', 'clave', 'secreto'].includes(k) ? tapar(valor[k])
        : ['cl', 'rc'].includes(k) ? (valor[k] ? '<id de nube>' : '') // ids aleatorios de la cola (crypto)
          : normalizar(valor[k])]));
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
const comparaciones = [
  [(r) => r.ajustes, `Ajustes guardados (panel-live → widgets.${vista})`],
  [(r) => r.config, 'Última configuración subida'],
  ...partes.map((p) => [(r) => r.otras[p], `panel-live → ${p}`]),
];
for (const [leer, titulo] of comparaciones) {
  const v = JSON.stringify(normalizar(leer(viejo)));
  const n = JSON.stringify(normalizar(leer(nuevo)));
  if (v !== n) diferencias++;
  informe.push(`■ ${titulo}: ${v === n ? 'IGUAL' : 'DISTINTO'}${leer(viejo) === null && leer(nuevo) === null ? ' (no hay)' : ''}`);
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
