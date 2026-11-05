// =============================================================================
// vite.config.ts — Compilación del panel y de los widgets (aplicación multipágina)
//
// Cada .html de la raíz es una URL publicada en GitHub Pages y debe conservar su nombre:
// las fuentes de navegador de OBS / TikTok LIVE Studio apuntan a ellas
// (https://ardiladev.github.io/live-tools/ruleta.html#c=…). Cada página carga solo su
// propio código (src/panel/main.tsx o src/widgets/<pagina>/main.tsx).
//
//   npm run dev       servidor de desarrollo (http://localhost:5173/)
//   npm run build     comprueba tipos y genera dist/ (lo que publica GitHub Pages)
//   npm test          pruebas (Vitest)
//
// `base: './'`: las rutas de los recursos son relativas, así dist/ funciona igual en
// https://ardiladev.github.io/live-tools/, en localhost o en cualquier otra carpeta.
// SOLO=ruleta,index npm run build → compila solo esas páginas (útil para revisar una).
// =============================================================================

/// <reference types="vitest/config" />
import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** Las páginas publicadas: el panel (index) y los 16 widgets. */
export const PAGINAS = [
  'index',
  'ruleta', 'tragamonedas',
  'carrera', 'marcador', 'batalla', 'activacion',
  'cola', 'jefe', 'boveda', 'subathon', 'extensible', 'repertorio',
  'meta', 'alertas', 'destacado', 'trono',
] as const;

const soloEstas = (process.env.SOLO || '').split(',').map((p) => p.trim()).filter(Boolean);
const paginas = soloEstas.length ? PAGINAS.filter((p) => soloEstas.includes(p)) : PAGINAS;

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2022',
    rolldownOptions: {
      input: Object.fromEntries(paginas.map((p) => [p, resolve(import.meta.dirname, `${p}.html`)])),
    },
  },
  server: { port: 5173 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'pruebas/unidad/**/*.test.ts'],
  },
});
