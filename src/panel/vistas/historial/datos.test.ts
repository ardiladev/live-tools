// Pruebas de las cuentas del historial: totales por bailarina, apoyos y hojas del Excel.
import { describe, expect, it } from 'vitest';
import type { FilaRegistroLeida } from '../../../nucleo/nube';
import { apoyos, deLeida, hojasExcel, totales } from './datos';

const T = 1_793_898_000_000;
const fila = (id: string, b: string, usuario: string, uid: string, monedas: number, cantidad = 1, origen: 'activador' | 'equipo' | 'apoyo' = 'apoyo', partes = 1, sesion = 's1'): FilaRegistroLeida =>
  [id, sesion, b, b.toUpperCase(), usuario, uid, '5655', '', cantidad, monedas, monedas * partes, partes, origen, T];

const FILAS = [
  fila('1', 'ana', 'Luis', 'u1', 10, 1, 'activador'),
  fila('2', 'ana', 'Luisito', 'u1', 20, 20),
  fila('3', 'ana', 'Marta', '', 3.3333, 1, 'equipo', 3),
  fila('4', 'bea', 'Marta', '', 3.3333, 1, 'equipo', 3),
  fila('5', 'caro', 'Marta', '', 3.3334, 1, 'equipo', 3, 's2'),
].map(deLeida);

describe('historial', () => {
  it('totales por bailarina: monedas (centésimas), regalos, personas distintas y activaciones', () => {
    expect(totales(FILAS, (id) => (id === 'ana' ? 'Ana María' : undefined))).toEqual([
      { id: 'ana', nombre: 'Ana María', monedas: 33.33, regalos: 22, personas: 2, activaciones: 2 },
      // Empatadas (3.3334 se ve como 3.33): por nombre.
      { id: 'bea', nombre: 'BEA', monedas: 3.33, regalos: 1, personas: 1, activaciones: 1 },
      { id: 'caro', nombre: 'CARO', monedas: 3.33, regalos: 1, personas: 1, activaciones: 1 },
    ]);
  });

  it('apoyos: la misma cuenta con otro apodo es la misma persona (queda el último apodo)', () => {
    expect(apoyos(FILAS, 'ana')).toEqual([
      { persona: 'u:u1', usuario: 'Luisito', monedas: 30, regalos: 21 },
      { persona: 'n:marta', usuario: 'Marta', monedas: 3.33, regalos: 1 },
    ]);
  });

  it('el Excel trae sus 4 hojas, con el resumen por LIVE separado', () => {
    const hojas = hojasExcel(FILAS, {
      sesiones: [
        { sesion: 's1', desde: T, hasta: T, monedas: 0, filas: 4, personas: 2 },
        { sesion: 's2', desde: T + 86400000, hasta: T + 86400000, monedas: 0, filas: 1, personas: 1 },
      ],
      nombreRegalo: (g) => (g === '5655' ? 'Rosa' : ''),
    });
    expect(hojas.map((h) => h.nombre)).toEqual(['Resumen', 'Por LIVE', 'Apoyos', 'Detalle']);
    expect(hojas[1]?.filas.map((f) => f[1])).toEqual(['ANA', 'BEA', 'CARO']);
    expect(hojas[3]?.filas[0]?.slice(2, 7)).toEqual(['ANA', 'Luis', 'Rosa', '5655', 1]);
  });
});
