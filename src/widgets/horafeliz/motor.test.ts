// Pruebas del widget "Hora feliz y racha": cuándo termina una racha y el récord.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventoRegalo } from '../../tipos/eventos';
import { crearMotorHoraFeliz, FINAL_MS } from './motor';

const T = 1_793_898_000_000;
const regalo = (cantidad = 1): EventoRegalo => ({ tipo: 'regalo', usuario: 'Luis', giftId: '1', nombre: '', cantidad, diamantes: 1, imagen: '' });

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(T); });
afterEach(() => { vi.useRealTimers(); });

describe('racha de regalos', () => {
  it('suma los regalos seguidos (un combo cuenta su cantidad) y termina tras los segundos sin regalos', () => {
    const m = crearMotorHoraFeliz();
    m.aplicarConfig({ rs: 5, rm: 3 });
    m.alEvento(regalo(1));
    vi.setSystemTime(T + 4000);
    m.alEvento(regalo(10));
    expect(m.obtener().racha).toBe(11);
    m.revisar(T + 4000 + 5001);
    expect(m.obtener().racha).toBe(0);
    expect(m.obtener().final).toMatchObject({ cuenta: 11, record: true });
    expect(m.obtener().mejor).toBe(11);
    m.revisar(T + 4000 + 5001 + FINAL_MS + 1);
    expect(m.obtener().final).toBeNull();
  });

  it('una racha por debajo del mínimo no se anuncia; con la racha apagada no cuenta nada', () => {
    const m = crearMotorHoraFeliz();
    m.aplicarConfig({ rs: 5, rm: 3 });
    m.alEvento(regalo(1));
    m.revisar(T + 6000);
    expect(m.obtener().final).toBeNull();
    m.aplicarConfig({ mr: 0 });
    m.alEvento(regalo(5));
    expect(m.obtener().racha).toBe(0);
  });
});
