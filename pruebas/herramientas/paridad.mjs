// =============================================================================
// pruebas/herramientas/paridad.mjs — Compara un widget viejo (legado/) con el nuevo (React)
//
// Abre la misma página en las dos versiones con la MISMA configuración y los MISMOS pasos
// (eventos de prueba, cambios de configuración, esperas, recargas) sobre un reloj simulado
// idéntico, y compara lo que se ve (texto), lo guardado (localStorage) y, si se pide, capturas.
//
// Requisitos: Chrome instalado; versión vieja en http://localhost:8080 (npm run legado) y la
// nueva en http://localhost:5173 (npm run dev).
//
//   node pruebas/herramientas/paridad.mjs pruebas/paridad/carrera.json
//
// Escenario (JSON):
//   {
//     "pagina": "carrera",                      // carrera.html
//     "consulta": "prueba=1&fondo=1",           // lo que va después de ? (opcional)
//     "config": { … },                          // va en #c= (codificada como lo hace el panel)
//     "ancho": 1920, "alto": 400,               // tamaño de la ventana (opcional)
//     "inicio": "2026-11-05T12:00:00-05:00",    // hora simulada al abrir (opcional)
//     "atributos": ".cancion, .relleno",        // compara también clases, data-* y estilo (opcional)
//     "pasos": [
//       { "evento": { "tipo": "regalo", … } },   // postMessage { tipo: 'simular', evento }
//       { "config": { … } },                     // postMessage { tipo: 'config', config }
//       { "tema": { … } },                       // postMessage { tipo: 'tema', est }
//       { "esperar": 2500 },                     // avanza el reloj simulado (ms)
//       { "recargar": true },                    // recarga la página (conserva localStorage)
//       { "captura": "despues-de-regalos" }      // compara texto y localStorage en este punto
//     ]
//   }
// Sale con código 1 si alguna captura no coincide. Las imágenes quedan en pruebas/salida/.
// =============================================================================

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { chromium } from 'playwright-core';

const VERSIONES = {
  legado: process.env.URL_LEGADO || 'http://localhost:8080',
  nuevo: process.env.URL_NUEVO || 'http://localhost:5173',
};

const codificar = (obj) => Buffer.from(JSON.stringify(obj), 'utf8').toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function correr(navegador, version, escenario, salida) {
  const contexto = await navegador.newContext({
    viewport: { width: escenario.ancho || 1280, height: escenario.alto || 720 },
  });
  // Azar con semilla fija: las dos versiones sacan los mismos números (premios, rodillos…)
  // siempre que llamen a Math.random en el mismo orden.
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
  // Supabase interceptado: ninguna prueba lee ni escribe en la base real (RPC → null, sin Realtime).
  // "rpc" en el escenario: respuestas simuladas por función, p. ej. { "leer_retos": { … } }.
  await contexto.route('**/rest/v1/rpc/**', (ruta) => {
    const funcion = ruta.request().url().split('/rpc/')[1];
    const respuesta = escenario.rpc?.[funcion] ?? null;
    return ruta.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(respuesta) });
  });
  await contexto.route('**/realtime/**', (ruta) => ruta.abort());
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on('pageerror', (e) => errores.push(String(e)));
  pagina.on('console', (m) => { if (m.type() === 'error' && !/realtime|websocket|ERR_FAILED/i.test(m.text())) errores.push(m.text()); });
  // Reloj simulado y DETENIDO: solo avanza con "esperar" (si corriera solo, lo que tarda cada
  // versión en cargar cambiaría los tiempos).
  const inicio = new Date(escenario.inicio || '2026-11-05T12:00:00-05:00');
  await pagina.clock.install({ time: inicio });
  await pagina.clock.pauseAt(new Date(inicio.getTime() + 1));
  const url = `${VERSIONES[version]}/${escenario.pagina}.html${escenario.consulta === undefined ? '?prueba=1&fondo=1' : (escenario.consulta ? `?${escenario.consulta}` : '')}#c=${codificar(escenario.config || {})}`;
  await pagina.goto(url, { waitUntil: 'load' });
  await pagina.clock.runFor(300);

  const capturas = {};
  const mandar = (datos) => pagina.evaluate((d) => window.postMessage(d, location.origin), datos);
  for (const paso of escenario.pasos || []) {
    if (paso.evento || paso.config) await pagina.evaluate(() => window.__reiniciarAzar?.());
    if (paso.evento) await mandar({ tipo: 'simular', evento: paso.evento });
    if (paso.config) await mandar({ tipo: 'config', config: paso.config });
    if (paso.tema) await mandar({ tipo: 'tema', est: paso.tema });
    if (paso.esperar) await pagina.clock.runFor(paso.esperar);
    if (paso.pausa) await pagina.waitForTimeout(paso.pausa); // espera REAL (p. ej. que cargue la librería de Supabase)
    if (paso.recargar) { await pagina.reload({ waitUntil: 'load' }); await pagina.clock.runFor(300); }
    if (paso.evento || paso.config || paso.tema) await pagina.clock.runFor(50);
    if (paso.captura) {
      const datos = await pagina.evaluate((selector) => ({
        texto: document.body.innerText.replace(/\s+/g, ' ').trim(),
        guardado: Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('live-tools:') && !k.startsWith('live-tools:widget:'))
          .sort().map((k) => [k, localStorage.getItem(k)])),
        // Clases (ordenadas), data-* y estilo en línea de los elementos pedidos ("atributos").
        atributos: selector ? [...document.querySelectorAll(selector)].map((el) => (
          `${[...el.classList].sort().join('.')} ${JSON.stringify({ ...el.dataset })} ${el.getAttribute('style') || ''}`.trim()
        )) : [],
      }), escenario.atributos || '');
      mkdirSync(salida, { recursive: true });
      await pagina.screenshot({ path: `${salida}/${paso.captura}-${version}.png`, animations: 'disabled' });
      capturas[paso.captura] = datos;
    }
  }
  await contexto.close();
  return { capturas, errores };
}

const archivo = process.argv[2];
if (!archivo) {
  console.error('Uso: node pruebas/herramientas/paridad.mjs <escenario.json>');
  process.exit(2);
}
const escenario = JSON.parse(readFileSync(archivo, 'utf8'));
const salida = `pruebas/salida/${basename(archivo, '.json')}`;
const navegador = await chromium.launch({ channel: 'chrome', headless: true });
const viejo = await correr(navegador, 'legado', escenario, salida);
const nuevo = await correr(navegador, 'nuevo', escenario, salida);
await navegador.close();

let diferencias = 0;
const informe = [];
for (const [nombre, v] of Object.entries(viejo.capturas)) {
  const n = nuevo.capturas[nombre] || {};
  const textoIgual = v.texto === n.texto;
  const guardadoIgual = JSON.stringify(v.guardado) === JSON.stringify(n.guardado);
  const atributosIguales = JSON.stringify(v.atributos) === JSON.stringify(n.atributos);
  if (!textoIgual || !guardadoIgual || !atributosIguales) diferencias++;
  informe.push(`■ ${nombre}: texto ${textoIgual ? 'IGUAL' : 'DISTINTO'} · localStorage ${guardadoIgual ? 'IGUAL' : 'DISTINTO'}`
    + (escenario.atributos ? ` · atributos ${atributosIguales ? 'IGUALES' : 'DISTINTOS'}` : ''));
  if (!textoIgual) informe.push(`    legado: ${v.texto}\n    nuevo:  ${n.texto}`);
  if (!guardadoIgual) informe.push(`    legado: ${JSON.stringify(v.guardado)}\n    nuevo:  ${JSON.stringify(n.guardado)}`);
  if (!atributosIguales) informe.push(`    legado: ${JSON.stringify(v.atributos)}\n    nuevo:  ${JSON.stringify(n.atributos)}`);
  informe.push(`    capturas: ${salida}/${nombre}-legado.png · ${salida}/${nombre}-nuevo.png`);
}
// Solo cuentan los errores que la versión vieja no tenía (p. ej. el 404 del favicon sale en las dos).
const erroresNuevos = nuevo.errores.filter((e) => !viejo.errores.includes(e));
if (viejo.errores.length) informe.push(`Errores (legado): ${viejo.errores.join(' | ')}`);
if (erroresNuevos.length) { informe.push(`Errores SOLO en la versión nueva: ${erroresNuevos.join(' | ')}`); diferencias++; }
const texto = informe.join('\n');
mkdirSync(salida, { recursive: true });
writeFileSync(`${salida}/informe.txt`, texto);
console.log(texto);
console.log(diferencias ? `\n✗ ${diferencias} diferencia(s)` : '\n✓ Sin diferencias');
process.exit(diferencias ? 1 : 0);
