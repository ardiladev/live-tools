// Pruebas de la Meta: el confeti solo se activa con cf = 1 y sus piezas son repetibles.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventoLive } from '../../tipos/eventos';
import { piezasConfeti } from './Confeti';
import { crearMotorMeta } from './motor';

const like = (cantidad: number): EventoLive => ({ tipo: 'like', usuario: 'Ana', cantidad, total: 0, propios: cantidad });

// aplicarConfig fija el color en <html>; en Node no hay document, así que se simula lo mínimo.
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('document', { documentElement: { style: { setProperty() {}, removeProperty() {} } } });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('confeti de la meta', () => {
  it('sin la clave cf queda apagado (como antes)', () => {
    const motor = crearMotorMeta();
    motor.aplicarConfig({ t: 'likes', o: 100, s: 0 });
    expect(motor.obtener().confeti).toBe(false);
  });

  it('con cf = 1 queda encendido y la celebración se cuenta al cruzar la meta', () => {
    const motor = crearMotorMeta();
    motor.aplicarConfig({ t: 'likes', o: 100, s: 0, cf: 1 });
    motor.alEvento(like(90));
    expect(motor.obtener().celebraciones).toBe(0);
    motor.alEvento(like(20));
    expect(motor.obtener()).toMatchObject({ confeti: true, celebraciones: 1 });
  });

  it('se puede apagar en vivo', () => {
    const motor = crearMotorMeta();
    motor.aplicarConfig({ t: 'likes', o: 100, s: 0, cf: 1 });
    motor.aplicarConfig({ t: 'likes', o: 100, s: 0 });
    expect(motor.obtener().confeti).toBe(false);
  });

  it('las piezas salen hacia arriba y son las mismas con la misma semilla', () => {
    const piezas = piezasConfeti(3);
    expect(piezas).toEqual(piezasConfeti(3));
    expect(piezas).not.toEqual(piezasConfeti(4));
    for (const p of piezas) {
      expect(p.alto).toBeLessThan(0);
      expect(p.caida).toBeGreaterThan(0);
      expect(Math.abs(p.dx)).toBeLessThanOrEqual(40);
    }
  });
});
