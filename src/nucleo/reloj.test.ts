// Pruebas del reloj de la ronda: guarda la HORA de término, así no se desfasa al recargar OBS.
import { describe, expect, it } from 'vitest';
import { formatoReloj, iniciarReloj, leerReloj, pausarReloj, reiniciarReloj } from './reloj';

const T = 1_793_898_000_000; // una hora cualquiera (ms)

describe('leerReloj', () => {
  it('listo: muestra la duración completa', () => {
    expect(leerReloj({ e: 'listo', d: 180 }, T)).toEqual({ estado: 'listo', restanteMs: 180000, duracionMs: 180000 });
  });

  it('corriendo: lo que falta hasta `fin`, calculado con la hora actual (sin desfase al recargar)', () => {
    const reloj = { e: 'corre' as const, d: 180, fin: T + 90000 };
    expect(leerReloj(reloj, T).restanteMs).toBe(90000);
    // Una "recarga" 30 s después lee el mismo reloj guardado y sigue exacto.
    expect(leerReloj(reloj, T + 30000).restanteMs).toBe(60000);
  });

  it('al pasar `fin` queda en fin con 0', () => {
    expect(leerReloj({ e: 'corre', d: 60, fin: T }, T)).toEqual({ estado: 'fin', restanteMs: 0, duracionMs: 60000 });
  });

  it('en pausa: lo que quedaba (r)', () => {
    expect(leerReloj({ e: 'pausa', d: 60, r: 12345 }, T).restanteMs).toBe(12345);
  });

  it('sin datos: listo con 60 s', () => {
    expect(leerReloj(undefined, T)).toEqual({ estado: 'listo', restanteMs: 60000, duracionMs: 60000 });
  });
});

describe('acciones del reloj', () => {
  it('iniciar desde listo: termina en ahora + duración', () => {
    expect(iniciarReloj({ e: 'listo', d: 120 }, T)).toEqual({ e: 'corre', d: 120, fin: T + 120000, r: 0 });
  });

  it('pausar y reanudar conserva lo que faltaba', () => {
    const corriendo = iniciarReloj({ e: 'listo', d: 120 }, T);
    const pausado = pausarReloj(corriendo, T + 20000);
    expect(pausado).toEqual({ e: 'pausa', d: 120, fin: 0, r: 100000 });
    // Se reanuda 5 min después: siguen faltando 100 s.
    const reanudado = iniciarReloj(pausado, T + 320000);
    expect(leerReloj(reanudado, T + 320000).restanteMs).toBe(100000);
  });

  it('iniciar uno que ya corre no lo cambia; pausar uno detenido tampoco', () => {
    const corriendo = { e: 'corre' as const, d: 60, fin: T + 1000, r: 0 };
    expect(iniciarReloj(corriendo, T)).toEqual(corriendo);
    expect(pausarReloj({ e: 'listo', d: 60 }, T)).toEqual({ e: 'listo', d: 60 });
  });

  it('desde fin, iniciar empieza con la duración completa', () => {
    expect(iniciarReloj({ e: 'corre', d: 30, fin: T - 1 }, T)).toEqual({ e: 'corre', d: 30, fin: T + 30000, r: 0 });
  });

  it('reiniciar: detenido con la duración completa', () => {
    expect(reiniciarReloj({ e: 'corre', d: 45, fin: T + 1, r: 0 })).toEqual({ e: 'listo', d: 45, fin: 0, r: 0 });
  });
});

describe('formatoReloj', () => {
  it.each([
    [0, '00:00'], [1, '00:01'], [999, '00:01'], [1000, '00:01'], [1001, '00:02'],
    [83000, '01:23'], [3723000, '1:02:03'], [-5, '00:00'],
  ])('%i ms → %s (redondea hacia arriba)', (ms, texto) => {
    expect(formatoReloj(ms)).toBe(texto);
  });
});
