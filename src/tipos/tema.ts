// =============================================================================
// tipos/tema.ts — Estilo visual de los widgets (clave `est` de la configuración)
//
// Claves cortas, porque sin Supabase viajan en la URL:
//   m   modo del cristal: 'o' obsidiana (oscuro) | 'p' perla (claro)
//   op  opacidad del fondo, 0–100 (%)        bl  desenfoque, 0–24 (px)
//   ac  color de acento · ac2 fin del degradado · ag acento en degradado (1/0)
//   cb  color del borde · gr borde metálico en degradado (1/0) · bw grosor, 0–4 (px)
//   gl  resplandor, 0–40 (px)                ra  radio de las esquinas, 0–20 (px)
//   fu  fuente · ls espaciado entre letras, 0–25 (centésimas de em)
//   tt  mayúsculas: 'u' MAYÚSCULAS | 'c' Primera Letra | 'n' normal
//   ct  color del texto principal · ca color de lo activo (premio, brillo) · ci color de insignias
//   tx  textura estática de prueba en las placas (1/0, apagada por defecto)
// =============================================================================

export type ModoCristal = 'o' | 'p';
export type Mayusculas = 'u' | 'c' | 'n';
export type Bandera = 0 | 1;

/** Un tema completo y válido (lo que devuelve normalizarTema). */
export interface Tema {
  m: ModoCristal;
  op: number;
  bl: number;
  ac: string;
  ac2: string;
  ag: Bandera;
  cb: string;
  gr: Bandera;
  bw: number;
  gl: number;
  ra: number;
  fu: string;
  ls: number;
  tt: Mayusculas;
  ct: string;
  ca: string;
  ci: string;
  tx: Bandera;
}

/** Lo que puede llegar en `est`: cualquier subconjunto, de cualquier tipo (se normaliza). */
export type TemaEntrada = Partial<Record<keyof Tema, unknown>> | null | undefined;

/** Un preset del editor de estilo. */
export interface PresetTema {
  nombre: string;
  tema: Omit<Tema, 'tx'>;
}
