// Pruebas de la configuración en la URL (#c=…): base64 url-safe de JSON en UTF-8.
import { describe, expect, it } from 'vitest';
import { codificar, configDanada, decodificar, leerConfig } from './configUrl';

describe('codificar / decodificar', () => {
  it('ida y vuelta con tildes, ñ y emojis', () => {
    const cfg = { u: 'añoñito', ti: 'Canción ✨ 💛', j: [{ n: 'Ñandú', m: 1000 }], s: 1 };
    expect(decodificar(codificar(cfg))).toEqual(cfg);
  });

  it('el texto es apto para URL (sin + / =)', () => {
    const texto = codificar({ x: '>>>???~~~', y: 'ÿÿÿ' });
    expect(texto).not.toMatch(/[+/=]/);
  });

  it('decodifica lo que codificaba el panel original (mismo formato)', () => {
    // {"u":"ana","w":"abc"} codificado por la versión vanilla.
    expect(decodificar('eyJ1IjoiYW5hIiwidyI6ImFiYyJ9')).toEqual({ u: 'ana', w: 'abc' });
  });
});

describe('leerConfig', () => {
  it('sin #c=: null', () => {
    expect(leerConfig('')).toBeNull();
    expect(leerConfig('#otra=1')).toBeNull();
  });

  it('con #c= válido: el objeto', () => {
    expect(leerConfig(`#c=${codificar({ u: 'ana', k: 'x' })}`)).toEqual({ u: 'ana', k: 'x' });
  });

  it('con #c= dañado: { error: true }', () => {
    const cfg = leerConfig('#c=%%%no-es-base64');
    expect(configDanada(cfg)).toBe(true);
    expect(configDanada(leerConfig(`#c=${codificar({ u: 'ana' })}`))).toBe(false);
    expect(configDanada(null)).toBe(false);
  });
});
