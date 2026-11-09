// Pruebas de la elección de monstruo del Jefe del LIVE: solo cambia el dibujo, nunca las reglas.
import { describe, expect, it } from 'vitest';
import { crearMotorJefe } from '../motor';
import { MONSTRUOS, tipoMonstruo } from './catalogo';

describe('catálogo de monstruos', () => {
  it('hay cinco, del menos al más amenazante, con ids distintos', () => {
    expect(MONSTRUOS.map((m) => m.amenaza)).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(MONSTRUOS.map((m) => m.id)).size).toBe(5);
  });

  it('sin `mo` o con uno desconocido sale la bestia (el monstruo de siempre)', () => {
    expect(tipoMonstruo(undefined)).toBe('bestia');
    expect(tipoMonstruo('kraken')).toBe('bestia');
    expect(tipoMonstruo(3)).toBe('bestia');
    expect(tipoMonstruo('dragon')).toBe('dragon');
  });
});

describe('motor del jefe con monstruo', () => {
  it('toma el monstruo de la configuración y lo cambia en vivo sin tocar la vida', () => {
    const motor = crearMotorJefe();
    motor.aplicarConfig({ hp: 1000, ro: 1, sr: 0, dl: 1 });
    expect(motor.obtener().monstruo).toBe('bestia');
    motor.alEvento({ tipo: 'like', usuario: 'A', cantidad: 100, total: 0, propios: 100 });
    motor.aplicarConfig({ hp: 1000, ro: 1, sr: 0, dl: 1, mo: 'rey' });
    expect(motor.obtener().monstruo).toBe('rey');
    expect(motor.obtener().dano).toBe(100);
  });
});
