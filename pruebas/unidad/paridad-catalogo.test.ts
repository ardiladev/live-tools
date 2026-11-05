// @vitest-environment jsdom
// =============================================================================
// pruebas/unidad/paridad-catalogo.test.ts — El catálogo de regalos nuevo contra el ORIGINAL
//
// 300 secuencias al azar (semilla fija) de regalos que llegan del LIVE, nombres propios,
// regalos agregados a mano, quitados, respuestas a "¿cambió de código?", "Entendido", regalos
// puestos en las ruletas y esperas pasan por legado/js/panel/almacen.js y por
// src/panel/estado/almacen.ts. Después de CADA paso tienen que quedar iguales: el catálogo,
// las preguntas, los "son distintos", los avisos de códigos cambiados y el regalo de cada
// ruleta. Se salta sola si legado/ ya no está.
// =============================================================================

import { resolve, sep } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

// La versión original: legado/ o, si ya se retiró, la copia sacada del historial (npm run legado:extraer).
import { carpetaLegadoSiEsta } from '../herramientas/legado.mjs';

const LEGADO: string = carpetaLegadoSiEsta();
const HAY_LEGADO = Boolean(LEGADO);
/** Importa un módulo de la versión original (ruta dentro de legado/). */
const delLegado = (ruta: string): Promise<any> => import(/* @vite-ignore */ resolve(LEGADO, ruta).split(sep).join('/'));

function crearAzar(semilla: number) {
  let s = semilla >>> 0;
  const siguiente = (): number => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    entero: (min: number, max: number): number => min + Math.floor(siguiente() * (max - min + 1)),
    uno: <T>(lista: readonly T[]): T => lista[Math.floor(siguiente() * lista.length)] as T,
    si: (p = 0.5): boolean => siguiente() < p,
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any -- el original es JavaScript sin tipos */
describe.skipIf(!HAY_LEGADO)('paridad del catálogo de regalos con el original', () => {
  afterEach(() => vi.useRealTimers());

  it('300 secuencias: después de cada paso, el mismo catálogo, preguntas y avisos', async () => {
    vi.useFakeTimers({ now: 1_793_898_000_000 });
    const viejo: any = await delLegado('js/panel/almacen.js');
    const nuevo = await import('../../src/panel/estado/almacen');
    const azar = crearAzar(11);
    const ids = ['5655', '5656', '17490', '17491', '6000'];
    const nombres = ['Rose', 'rose ', 'ROSE', 'Capybara', 'Candy Bouquet', '', 'Rosa'];

    const parte = (e: any) => JSON.parse(JSON.stringify({
      regalos: e.regalos, sugerencias: e.sugerencias, distintos: e.distintos, cambiosDeCodigo: e.cambiosDeCodigo,
      ruletas: [e.widgets?.ruleta?.giftId ?? null, e.widgets?.['ruleta-premium']?.giftId ?? null],
    }));
    const fotoVieja = () => {
      viejo.guardar(); // escribe TODO su estado en localStorage
      return parte(JSON.parse(localStorage.getItem('panel-live') || '{}'));
    };
    const fotoNueva = () => parte(nuevo.obtener());

    for (let caso = 0; caso < 300; caso++) {
      // Los dos empiezan vacíos.
      localStorage.setItem('panel-live', JSON.stringify(nuevo.estadoInicial()));
      viejo.cargar();
      nuevo.usarAlmacen.setState(nuevo.estadoInicial(), true);

      for (let paso = 0; paso < 30; paso++) {
        const accion = azar.uno(['regalo', 'regalo', 'regalo', 'regalo', 'nombrar', 'anotar', 'quitar', 'responder', 'responder', 'olvidar', 'ruleta', 'esperar']);
        let detalle: unknown = accion;
        if (accion === 'regalo') {
          const evento = { giftId: azar.uno(ids), nombre: azar.uno(nombres), imagen: azar.uno(['', 'https://x/a.png']), diamantes: azar.uno([0, 1, 99, 249, 349]), cantidad: azar.entero(1, 3) };
          detalle = evento;
          viejo.registrarRegalo({ ...evento });
          nuevo.registrarRegalo({ ...evento });
        } else if (accion === 'nombrar') {
          const [id, nombre] = [azar.uno(ids), azar.uno([...nombres, 'Mi regalo'])];
          detalle = ['nombrar', id, nombre];
          viejo.nombrarRegalo(id, nombre);
          nuevo.nombrarRegalo(id, nombre);
        } else if (accion === 'anotar') {
          const id = azar.uno([...ids, ' 7000 ', '']);
          detalle = ['anotar', id];
          viejo.anotarRegalo(id, { ultimo: Date.now() });
          nuevo.anotarRegalo(id, { ultimo: Date.now() });
        } else if (accion === 'quitar') {
          const id = azar.uno(ids);
          detalle = ['quitar', id];
          viejo.quitarRegalo(id);
          nuevo.quitarRegalo(id);
        } else if (accion === 'responder') {
          const deViejo = viejo.sugerencias()[0];
          expect(nuevo.sugerenciasVigentes(nuevo.obtener())[0], `caso ${caso} paso ${paso}: primera pregunta`).toEqual(deViejo);
          if (deViejo) {
            const esElMismo = azar.si();
            detalle = ['responder', deViejo, esElMismo];
            viejo.responderSugerencia(deViejo, esElMismo);
            nuevo.responderSugerencia(deViejo, esElMismo);
          }
        } else if (accion === 'olvidar') {
          viejo.olvidarCambiosDeCodigo();
          nuevo.olvidarCambiosDeCodigo();
        } else if (accion === 'ruleta') {
          const [id, giftId] = [azar.uno(['ruleta', 'ruleta-premium']), azar.uno(ids)];
          detalle = ['ruleta', id, giftId];
          viejo.widget(id).giftId = giftId;
          viejo.guardar();
          nuevo.cambiarWidget<Record<string, unknown>>(id, {}, (w) => { w.giftId = giftId; });
        } else {
          vi.advanceTimersByTime(azar.uno([1, 1000, 60000]));
        }
        expect(fotoNueva(), `caso ${caso} paso ${paso}: ${JSON.stringify(detalle)}`).toEqual(fotoVieja());
      }
    }
  });
});
