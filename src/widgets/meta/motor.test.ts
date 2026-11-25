// Pruebas de la Meta: el confeti solo se activa con cf = 1, dura cd segundos y sus piezas son repetibles.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventoLive } from '../../tipos/eventos';
import { piezasConfeti } from './Confeti';
import { crearMotorMeta, SEGUNDOS_CONFETI, segundosConfeti } from './motor';

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

  it('cd: segundos que sigue saliendo (0 = mientras la meta esté llena; sin clave = 5)', () => {
    expect(segundosConfeti(undefined)).toBe(SEGUNDOS_CONFETI);
    expect(segundosConfeti(10)).toBe(10);
    expect(segundosConfeti(0)).toBe(0);
    expect(segundosConfeti('20')).toBe(20);
    expect(segundosConfeti(9999)).toBe(300);
    expect(segundosConfeti(-3)).toBe(SEGUNDOS_CONFETI);
    expect(segundosConfeti('nada')).toBe(SEGUNDOS_CONFETI);
    const motor = crearMotorMeta();
    motor.aplicarConfig({ t: 'likes', o: 100, s: 0, cf: 1, cd: 0 });
    expect(motor.obtener().segundosConfeti).toBe(0);
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
