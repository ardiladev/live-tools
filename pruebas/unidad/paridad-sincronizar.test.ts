// @vitest-environment jsdom
// =============================================================================
// pruebas/unidad/paridad-sincronizar.test.ts — Los cambios en vivo nuevos contra el ORIGINAL
//
// La misma sesión del panel, con el widget Trono, pasa por legado/js/panel/sincronizar.js y por
// src/panel/estado/sincronizar.ts con el MISMO fetch simulado (Supabase nunca se toca):
//   - al arrancar se sube lo que tenga identificador;
//   - un cambio se sube 0,6 s después del ÚLTIMO cambio (no en cada tecla);
//   - una orden de juego (reinicio) se sube de inmediato;
//   - si Supabase falla, reintenta a los 5 s, 10 s, 20 s… hasta 1 min, y al volver sube;
//   - sin cambios reales no se sube nada; el usuario de Conexión viaja como `u`.
// Se comparan las llamadas: en qué milisegundo, a qué función y con qué datos (incluido `_v`).
// Se salta sola si legado/ ya no está.
// =============================================================================

import { resolve, sep } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

// La versión original: legado/ o, si ya se retiró, la copia sacada del historial (npm run legado:extraer).
import { carpetaLegadoSiEsta } from '../herramientas/legado.mjs';

const LEGADO: string = carpetaLegadoSiEsta();
const HAY_LEGADO = Boolean(LEGADO);
/** Importa un módulo de la versión original (ruta dentro de legado/). */
const delLegado = (ruta: string): Promise<any> => import(/* @vite-ignore */ resolve(LEGADO, ruta).split(sep).join('/'));
const T0 = 1_793_898_000_000;

const SEMILLA = {
  conexion: { usuario: '@cuentaprueba', clave: 'clave-falsa' },
  widgets: {},
  menuCerrados: [],
  preferencias: { autoConectar: false },
  temasPropios: {},
  regalos: {},
  sugerencias: [],
  distintos: [],
  cambiosDeCodigo: [],
  nube: { secreto: 'secreto-de-prueba', ids: { trono: 'idTronoPrueba' } },
};

/* eslint-disable @typescript-eslint/no-explicit-any -- el original es JavaScript sin tipos */
interface Pasos {
  cambiarTitulo(titulo: string): void;
  cambiarUsuario(usuario: string): void;
  ordenReinicio(): void;
}

/** Corre la misma sesión y devuelve las llamadas a Supabase: [ms desde el inicio, función, datos]. */
async function sesion(preparar: () => Promise<{ pasos: Pasos }>) {
  vi.useFakeTimers({ now: T0 });
  localStorage.setItem('panel-live', JSON.stringify(SEMILLA));
  const llamadas: unknown[] = [];
  let falla = false;
  globalThis.fetch = vi.fn(async (url: RequestInfo | URL, opciones?: RequestInit) => {
    llamadas.push([Date.now() - T0, String(url).split('/rpc/')[1], JSON.parse(String(opciones?.body)), falla ? 'falla' : 'ok']);
    return falla
      ? new Response(JSON.stringify({ message: 'sin red' }), { status: 503 })
      : new Response('null', { status: 200 });
  }) as typeof fetch;
  const esperar = (ms: number) => vi.advanceTimersByTimeAsync(ms);
  const { pasos } = await preparar();

  await esperar(700);                                  // arranque: sube lo que tenga identificador
  pasos.cambiarTitulo('A'); await esperar(300);
  pasos.cambiarTitulo('AB'); await esperar(599);        // aún no (0,6 s desde el ÚLTIMO cambio)
  await esperar(1);                                     // ahora sí
  pasos.ordenReinicio(); await esperar(0);              // orden: de inmediato
  pasos.cambiarTitulo('AB'); await esperar(1000);       // sin cambio real: no sube
  falla = true;
  pasos.cambiarTitulo('ABC'); await esperar(600);       // falla → reintento a los 5 s, 10 s, 20 s…
  await esperar(5000 + 10000 + 20000 + 40000 + 60000 + 60000);
  falla = false;
  await esperar(60000);                                 // vuelve la red: sube y deja de reintentar
  await esperar(120000);
  pasos.cambiarUsuario('@otracuenta'); await esperar(600);
  vi.useRealTimers();
  return llamadas;
}

describe.skipIf(!HAY_LEGADO)('paridad de los cambios en vivo (sincronizar) con el original', () => {
  afterEach(() => vi.useRealTimers());

  it('mismas subidas, en los mismos milisegundos y con los mismos datos', async () => {
    const delViejo = await sesion(async () => {
      const almacen: any = await delLegado('js/panel/almacen.js');
      almacen.cargar();
      await delLegado('js/panel/vistas/trono.js'); // registra el trono en sincronizar
      const sincronizar: any = await delLegado('js/panel/sincronizar.js');
      sincronizar.iniciar();
      const trono = () => almacen.widget('trono');
      return {
        pasos: {
          cambiarTitulo(titulo) { trono().titulo = titulo; almacen.guardar(); },
          cambiarUsuario(usuario) { almacen.conexion().usuario = usuario; almacen.guardar(); },
          ordenReinicio() { trono().ronda = Date.now(); almacen.guardar(); void sincronizar.subir('trono'); },
        },
      };
    });

    const delNuevo = await sesion(async () => {
      const almacen = await import('../../src/panel/estado/almacen');
      almacen.cargar();
      const { POR_DEFECTO } = await import('../../src/panel/vistas/trono/config'); // registra el trono
      const sincronizar = await import('../../src/panel/estado/sincronizar');
      sincronizar.iniciar();
      return {
        pasos: {
          cambiarTitulo(titulo) { almacen.cambiarWidget('trono', POR_DEFECTO, (a) => { a.titulo = titulo; }); },
          cambiarUsuario(usuario) { almacen.cambiarConexion({ usuario }); },
          ordenReinicio() { almacen.cambiarWidget('trono', POR_DEFECTO, (a) => { a.ronda = Date.now(); }); void sincronizar.subir('trono'); },
        },
      };
    });

    // La versión nueva agrega `tx: 0` al estilo (la textura estática, apagada): no cuenta.
    const sinTextura = (llamadas: unknown[]) => JSON.parse(JSON.stringify(llamadas), (k, v) => (k === 'tx' && v === 0 ? undefined : v));
    expect(sinTextura(delNuevo)).toEqual(sinTextura(delViejo));
    // Y lo que se esperaba: arranque, 1 cambio agrupado, la orden, 1 + 6 fallas, el éxito y el usuario.
    //   600: arranque · 1600: 0,6 s después del último cambio (1000) · 1600: la orden, sin esperar
    //   3200: falla → reintentos a +5, +10, +20, +40, +60, +60 s · 258200: vuelve la red
    //   378800: el usuario nuevo (0,6 s después del cambio)
    expect(delViejo.map((l: any) => [l[0], l[3]])).toEqual([
      [600, 'ok'], [1600, 'ok'], [1600, 'ok'],
      [3200, 'falla'], [8200, 'falla'], [18200, 'falla'], [38200, 'falla'], [78200, 'falla'], [138200, 'falla'], [198200, 'falla'],
      [258200, 'ok'], [378800, 'ok'],
    ]);
    // La orden lleva la ronda nueva; el último, el usuario nuevo (sin @).
    expect((delNuevo[2] as any)[2].p_config.ro).toBe(T0 + 1600);
    expect((delNuevo.at(-1) as any)[2].p_config.u).toBe('otracuenta');
  });
});
