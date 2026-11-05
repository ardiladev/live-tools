// =============================================================================
// pruebas/herramientas/servir.mjs — Servidor estático mínimo (sin dependencias)
//
// Sirve una carpeta por HTTP, por ejemplo la versión anterior del proyecto para compararla:
//   node pruebas/herramientas/servir.mjs legado 8080   →  http://localhost:8080/carrera.html
//   node pruebas/herramientas/servir.mjs dist 4173     →  el build de producción
// (Los módulos JS necesitan http://; abrir los .html con doble clic no sirve.)
// =============================================================================

import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { carpetaLegado } from './legado.mjs';

const [carpeta = 'legado', puerto = '8080'] = process.argv.slice(2);
// "legado": la versión original; si ya no está en el repositorio, se saca del historial de git.
const raiz = carpeta === 'legado' ? carpetaLegado() : resolve(carpeta);
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ico': 'image/x-icon', '.webp': 'image/webp',
};

createServer((pedido, respuesta) => {
  const ruta = decodeURIComponent(new URL(pedido.url, 'http://x').pathname);
  let archivo = normalize(join(raiz, ruta));
  if (!archivo.startsWith(raiz)) { respuesta.writeHead(403).end(); return; }
  if (existsSync(archivo) && statSync(archivo).isDirectory()) archivo = join(archivo, 'index.html');
  if (!existsSync(archivo)) { respuesta.writeHead(404).end('No existe'); return; }
  respuesta.writeHead(200, { 'Content-Type': TIPOS[extname(archivo)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  createReadStream(archivo).pipe(respuesta);
}).listen(Number(puerto), () => console.log(`Sirviendo ${raiz} en http://localhost:${puerto}/`));
