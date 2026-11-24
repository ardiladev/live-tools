// pruebas/unidad/xlsx.test.ts — El armado de archivos de Excel (src/panel/xlsx.ts): el ZIP es
// válido (firmas, tamaños y CRC) y las hojas llevan lo que se les pasó. Con XLSX_SALIDA=<ruta>,
// además deja el archivo ahí para abrirlo con Excel u openpyxl.
import { writeFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { crearXlsx, crearZip, type Hoja } from '../../src/panel/xlsx';

/** Lee un ZIP (solo lo necesario para estas pruebas): { ruta: contenido }. */
function leerZip(bytes: Uint8Array): Record<string, string> {
  const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const archivos: Record<string, string> = {};
  let pos = 0;
  while (vista.getUint32(pos, true) === 0x04034B50) {
    const metodo = vista.getUint16(pos + 8, true);
    const tamano = vista.getUint32(pos + 18, true);
    const largoNombre = vista.getUint16(pos + 26, true);
    const nombre = new TextDecoder().decode(bytes.subarray(pos + 30, pos + 30 + largoNombre));
    const datos = bytes.subarray(pos + 30 + largoNombre, pos + 30 + largoNombre + tamano);
    archivos[nombre] = new TextDecoder().decode(metodo ? inflateRawSync(datos) : datos);
    pos += 30 + largoNombre + tamano;
  }
  expect(vista.getUint32(bytes.length - 22, true)).toBe(0x06054B50);
  return archivos;
}

const HOJAS: Hoja[] = [
  {
    nombre: 'Resumen',
    columnas: [{ titulo: 'Bailarina', ancho: 20 }, { titulo: 'Monedas', formato: 'decimal' }, { titulo: 'Regalos', formato: 'entero' }],
    filas: [['Ana & <Bea>', 1234.5, 10], ['Sofía "la reina"', 0.3333, 1], ['', null, undefined]],
  },
  {
    nombre: 'Detalle/hoy',
    columnas: [{ titulo: 'Hora', formato: 'fecha' }, { titulo: 'Persona' }],
    filas: [[new Date(2026, 10, 24, 20, 15, 30), 'Luis']],
  },
];

describe('xlsx', () => {
  it('arma un ZIP válido con las hojas, los textos escapados y los nombres de hoja limpios', () => {
    const bytes = crearXlsx(HOJAS);
    if (process.env.XLSX_SALIDA) writeFileSync(process.env.XLSX_SALIDA, bytes);
    const zip = leerZip(bytes);
    expect(Object.keys(zip)).toEqual([
      '[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml',
      'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml',
    ]);
    expect(zip['xl/workbook.xml']).toContain('name="Detalle hoy"');
    expect(zip['xl/worksheets/sheet1.xml']).toContain('Ana &amp; &lt;Bea&gt;');
    expect(zip['xl/worksheets/sheet1.xml']).toContain('<c r="B2" s="3"><v>1234.5</v></c>');
    expect(zip['xl/worksheets/sheet1.xml']).toContain('<autoFilter ref="A1:C4"/>');
    // 24/11/2026 20:15:30 → serie de Excel 46350.84409…
    expect(zip['xl/worksheets/sheet2.xml']).toMatch(/<c r="A2" s="4"><v>46350\.8440972/);
  });

  it('el CRC de cada archivo es el estándar (el mismo de zlib)', () => {
    const zip = crearZip([['a.txt', 'hola']]);
    const crc = new DataView(zip.buffer).getUint32(14, true);
    expect(crc.toString(16)).toBe('6fa0f988'); // crc32("hola"), el mismo de zlib
  });
});
