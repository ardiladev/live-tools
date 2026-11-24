// =============================================================================
// panel/xlsx.ts — Archivo de Excel (.xlsx) armado en el navegador, sin librerías
//
// Un .xlsx es un ZIP con unos XML adentro (Office Open XML). Para exportar el registro de las
// bailarinas basta lo mínimo: varias hojas, fila de títulos en negrita (fija y con filtro),
// anchos de columna, números con separador de miles y fechas de verdad (Excel las ordena y
// filtra como fechas). El ZIP va sin comprimir (método «store»): Excel lo abre igual.
//
//   const archivo = crearXlsx([{ nombre: 'Resumen', columnas: [...], filas: [[...], ...] }]);
//   descargar(archivo, 'registro.xlsx');
//
// Secciones: 1. Hojas · 2. XML · 3. ZIP · 4. Descargar
// =============================================================================


// -----------------------------------------------------------------------------
// 1. Hojas
// -----------------------------------------------------------------------------

/** Cómo se muestra una columna: texto, número entero, número con decimales o fecha y hora. */
export type FormatoColumna = 'texto' | 'entero' | 'decimal' | 'fecha';

export interface Columna {
  titulo: string;
  formato?: FormatoColumna;
  /** Ancho en caracteres (aprox.). */
  ancho?: number;
}

/** Una celda: texto, número, fecha (Date) o vacía. */
export type Celda = string | number | Date | null | undefined;

export interface Hoja {
  nombre: string;
  columnas: Columna[];
  filas: Celda[][];
}

// Estilos (índices de cellXfs en styles.xml): 0 normal · 1 título · 2 entero · 3 decimal · 4 fecha
const ESTILO: Record<FormatoColumna | 'titulo', number> = { texto: 0, titulo: 1, entero: 2, decimal: 3, fecha: 4 };


// -----------------------------------------------------------------------------
// 2. XML
// -----------------------------------------------------------------------------

const escapar = (texto: string): string => texto
  // Excel no acepta caracteres de control en el XML (salvo tab y saltos de línea).
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '') // eslint-disable-line no-control-regex
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** "A", "B", … "Z", "AA"… */
function letra(columna: number): string {
  let n = columna + 1;
  let texto = '';
  while (n > 0) {
    const resto = (n - 1) % 26;
    texto = String.fromCharCode(65 + resto) + texto;
    n = Math.floor((n - 1) / 26);
  }
  return texto;
}

/** Fecha → número de serie de Excel (días desde 1900), con la hora local de este computador. */
const serieExcel = (fecha: Date): number =>
  (fecha.getTime() - fecha.getTimezoneOffset() * 60000) / 86400000 + 25569;

function celdaXml(valor: Celda, ref: string, formato: FormatoColumna): string {
  if (valor === null || valor === undefined || valor === '') return '';
  if (valor instanceof Date) return `<c r="${ref}" s="${ESTILO.fecha}"><v>${serieExcel(valor)}</v></c>`;
  if (typeof valor === 'number' && Number.isFinite(valor)) return `<c r="${ref}" s="${ESTILO[formato]}"><v>${valor}</v></c>`;
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapar(String(valor))}</t></is></c>`;
}

function hojaXml(hoja: Hoja): string {
  const columnas = hoja.columnas;
  const ultima = letra(Math.max(0, columnas.length - 1));
  const titulos = columnas.map((c, i) => `<c r="${letra(i)}1" t="inlineStr" s="${ESTILO.titulo}"><is><t xml:space="preserve">${escapar(c.titulo)}</t></is></c>`).join('');
  const filas = hoja.filas.map((fila, f) => {
    const n = f + 2;
    const celdas = columnas.map((c, i) => celdaXml(fila[i], `${letra(i)}${n}`, c.formato || 'texto')).join('');
    return `<row r="${n}">${celdas}</row>`;
  }).join('');
  const anchos = columnas.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.ancho || 14}" customWidth="1"/>`).join('');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    + `<cols>${anchos}</cols>`
    + `<sheetData><row r="1">${titulos}</row>${filas}</sheetData>`
    + `<autoFilter ref="A1:${ultima}${hoja.filas.length + 1}"/>`
    + '</worksheet>';
}

/** Nombre de hoja válido para Excel: sin []:*?/\ y de 31 caracteres como máximo. */
const nombreHoja = (nombre: string, i: number): string => (nombre.replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31) || `Hoja ${i + 1}`);

function archivosXml(hojas: Hoja[]): [string, string][] {
  const tipos = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    + hojas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
    + '</Types>';
  const rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
    + '</Relationships>';
  const libro = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    + '<sheets>'
    + hojas.map((h, i) => `<sheet name="${escapar(nombreHoja(h.nombre, i))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')
    + '</sheets>'
    // El filtro de cada hoja necesita su nombre definido (si no, Excel lo descarta al abrir).
    + '<definedNames>'
    + hojas.map((h, i) => `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${escapar(nombreHoja(h.nombre, i)).replace(/'/g, "''")}'!$A$1:$${letra(Math.max(0, h.columnas.length - 1))}$${h.filas.length + 1}</definedName>`).join('')
    + '</definedNames>'
    + '</workbook>';
  const relsLibro = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + hojas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
    + `<Relationship Id="rId${hojas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`
    + '</Relationships>';
  const estilos = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy hh:mm:ss"/></numFmts>'
    + '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
    + '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'
    + '<fill><patternFill patternType="solid"><fgColor rgb="FFF3E6BF"/><bgColor indexed="64"/></patternFill></fill></fills>'
    + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
    + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    + '<cellXfs count="5">'
    + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
    + '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>'
    + '<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
    + '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
    + '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
    + '</cellXfs>'
    + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
    + '</styleSheet>';
  return [
    ['[Content_Types].xml', tipos],
    ['_rels/.rels', rels],
    ['xl/workbook.xml', libro],
    ['xl/_rels/workbook.xml.rels', relsLibro],
    ['xl/styles.xml', estilos],
    ...hojas.map((h, i): [string, string] => [`xl/worksheets/sheet${i + 1}.xml`, hojaXml(h)]),
  ];
}


// -----------------------------------------------------------------------------
// 3. ZIP (sin compresión)
// -----------------------------------------------------------------------------

let tablaCrc: Uint32Array | null = null;
function crc32(datos: Uint8Array): number {
  if (!tablaCrc) {
    tablaCrc = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      tablaCrc[n] = c >>> 0;
    }
  }
  let crc = 0xFFFFFFFF;
  for (const byte of datos) crc = (tablaCrc[(crc ^ byte) & 0xFF] as number) ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/** Arma un ZIP sin comprimir con los archivos [ruta, contenido]. */
export function crearZip(archivos: [string, string | Uint8Array][]): Uint8Array {
  const codificador = new TextEncoder();
  const partes: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let desplazamiento = 0;
  // Fecha fija (1/1/2026 00:00) en formato MS-DOS: no importa para Excel.
  const hora = 0;
  const fecha = ((2026 - 1980) << 9) | (1 << 5) | 1;

  for (const [ruta, contenido] of archivos) {
    const nombre = codificador.encode(ruta);
    const datos = typeof contenido === 'string' ? codificador.encode(contenido) : contenido;
    const crc = crc32(datos);

    const local = new Uint8Array(30 + nombre.length);
    const l = new DataView(local.buffer);
    l.setUint32(0, 0x04034B50, true);
    l.setUint16(4, 20, true);              // versión necesaria
    l.setUint16(6, 0x0800, true);          // nombres en UTF-8
    l.setUint16(8, 0, true);               // sin comprimir
    l.setUint16(10, hora, true);
    l.setUint16(12, fecha, true);
    l.setUint32(14, crc, true);
    l.setUint32(18, datos.length, true);
    l.setUint32(22, datos.length, true);
    l.setUint16(26, nombre.length, true);
    l.setUint16(28, 0, true);
    local.set(nombre, 30);

    const registro = new Uint8Array(46 + nombre.length);
    const c = new DataView(registro.buffer);
    c.setUint32(0, 0x02014B50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true);
    c.setUint16(12, hora, true);
    c.setUint16(14, fecha, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, datos.length, true);
    c.setUint32(24, datos.length, true);
    c.setUint16(28, nombre.length, true);
    c.setUint32(42, desplazamiento, true);
    registro.set(nombre, 46);

    partes.push(local, datos);
    central.push(registro);
    desplazamiento += local.length + datos.length;
  }

  const tamanoCentral = central.reduce((s, r) => s + r.length, 0);
  const fin = new Uint8Array(22);
  const f = new DataView(fin.buffer);
  f.setUint32(0, 0x06054B50, true);
  f.setUint16(8, archivos.length, true);
  f.setUint16(10, archivos.length, true);
  f.setUint32(12, tamanoCentral, true);
  f.setUint32(16, desplazamiento, true);

  const todo = new Uint8Array(desplazamiento + tamanoCentral + fin.length);
  let pos = 0;
  for (const p of [...partes, ...central, fin]) {
    todo.set(p, pos);
    pos += p.length;
  }
  return todo;
}

/** El libro de Excel con estas hojas (bytes del .xlsx). */
export const crearXlsx = (hojas: Hoja[]): Uint8Array => crearZip(archivosXml(hojas));


// -----------------------------------------------------------------------------
// 4. Descargar
// -----------------------------------------------------------------------------

export const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Descarga los bytes como un archivo. */
export function descargar(bytes: Uint8Array, nombre: string, tipo = TIPO_XLSX): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: tipo }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
