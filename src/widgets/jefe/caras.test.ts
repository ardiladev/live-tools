// Pruebas de qué cara pone el monstruo del jefe (Monstruo.tsx): la fase manda; si está peleando,
// el dolor de un golpe reciente; si no, la etapa de vida.
import { describe, expect, it } from 'vitest';
import { caraDe, etapaDe } from './Monstruo';

describe('cara del monstruo', () => {
  it('la etapa cambia cada 25 % de vida', () => {
    expect([1, 0.8, 0.75, 0.6, 0.5, 0.3, 0.25, 0.01].map(etapaDe)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
  });

  it('sin golpe reciente, la cara de la etapa (también con el reloj sin iniciar, como en la vista previa)', () => {
    expect(caraDe(1, 'listo')).toBe('confiado');
    expect(caraDe(2, 'corre')).toBe('molesto');
    expect(caraDe(3, 'corre')).toBe('herido');
    expect(caraDe(4, 'listo')).toBe('mareado');
  });

  it('justo después de un golpe, cara de dolor en cualquier etapa', () => {
    expect(caraDe(1, 'listo', true)).toBe('dolor');
    expect(caraDe(4, 'corre', true)).toBe('dolor');
  });

  it('la fase gana al dolor: vencido, escapó y pausa', () => {
    expect(caraDe(4, 'vencido', true)).toBe('ko');
    expect(caraDe(1, 'escapo', true)).toBe('risa');
    expect(caraDe(2, 'pausa', true)).toBe('dormido');
  });
});
