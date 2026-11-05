// =============================================================================
// panel/componentes/ui.tsx — Piezas de interfaz que reusan todas las vistas del panel
//
// Todo el texto (nombres y mensajes del chat que vienen de TikTok incluidos) se pinta como
// texto con JSX: React nunca lo interpreta como HTML. Estilos: src/estilos/panel.css.
// Secciones: 1. Íconos · 2. Tarjeta · 3. Campos · 4. Casilla, deslizador y segmentado
//            5. Notas, avisos y números
// =============================================================================

import {
  useCallback, useEffect, useRef, useState,
  type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes,
} from 'react';


// -----------------------------------------------------------------------------
// 1. Íconos (SVG de trazo, heredan el color del texto)
// -----------------------------------------------------------------------------

const ICONOS = {
  enlace: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
  flecha: 'm9 6 6 6-6 6',
  engrane: 'M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  monitor: 'M5 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM8 20h8M12 16v4',
  pulso: 'M3 12h4l3-8 4 16 3-8h4',
  // Dado: un cuadrado redondeado con cinco puntos (círculos pequeños).
  juegos: 'M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zM7.5 8.5a1 1 0 1 0 2 0a1 1 0 1 0-2 0M14.5 8.5a1 1 0 1 0 2 0a1 1 0 1 0-2 0M11 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0M7.5 15.5a1 1 0 1 0 2 0a1 1 0 1 0-2 0M14.5 15.5a1 1 0 1 0 2 0a1 1 0 1 0-2 0',
  ajustes: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M18 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0M12 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0M20 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0',
} as const;

export type NombreIcono = keyof typeof ICONOS;

export function Icono({ nombre, className }: { nombre: NombreIcono; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className ? `icono-trazo ${className}` : 'icono-trazo'}>
      <path d={ICONOS[nombre]} />
    </svg>
  );
}


// -----------------------------------------------------------------------------
// 2. Tarjeta con título (`ancha` ocupa todo el ancho de la rejilla)
// -----------------------------------------------------------------------------

export function Tarjeta({ titulo, ancha = false, id, oculta = false, children }: {
  titulo: ReactNode; ancha?: boolean; id?: string;
  /** Con el atributo hidden (p. ej. los equipos que no están en juego). */
  oculta?: boolean;
  children?: ReactNode;
}) {
  return (
    <section className={ancha ? 'tarjeta ancha' : 'tarjeta'} id={id} hidden={oculta}>
      <h2>{titulo}</h2>
      {children}
    </section>
  );
}


// -----------------------------------------------------------------------------
// 3. Campos
// -----------------------------------------------------------------------------

type AtributosEntrada = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>;

/**
 * Número que se puede borrar y volver a escribir: guarda su propio texto mientras se edita
 * (como los campos del panel original) y avisa `alCambiar(Number(texto))` en cada cambio.
 * Si el valor cambia desde afuera (p. ej. al elegir un regalo del catálogo), se muestra ese.
 */
export function EntradaNumero({ valor, alCambiar, ...resto }: AtributosEntrada & { valor: number | string; alCambiar?: (v: number) => void }) {
  const [texto, setTexto] = useState(String(valor ?? ''));
  const ultimo = useRef(valor);
  if (valor !== ultimo.current) {
    ultimo.current = valor;
    if (Number(texto) !== Number(valor) || texto.trim() === '') setTexto(String(valor ?? ''));
  }
  return (
    <input
      type="number"
      value={texto}
      onChange={(e) => {
        setTexto(e.target.value);
        const n = Number(e.target.value);
        ultimo.current = n;
        alCambiar?.(n);
      }}
      {...resto}
    />
  );
}

export type OpcionesSelect = ReadonlyArray<readonly [string | number, string]>;

interface BaseCampo extends AtributosEntrada {
  etiqueta: ReactNode;
}

/**
 * Props de <Campo>, según `tipo`:
 *   text | password | color → alCambiar(texto) · number → alCambiar(número)
 *   select → `opciones` como [[valor, texto], …] y alCambiar(texto del valor elegido)
 */
export type PropsCampo =
  | (BaseCampo & { tipo?: 'text' | 'password' | 'color'; valor?: string; alCambiar?: (valor: string) => void })
  | (BaseCampo & { tipo: 'number'; valor?: number | string; alCambiar?: (valor: number) => void })
  | (BaseCampo & {
    tipo: 'select'; valor?: string | number; opciones: OpcionesSelect; alCambiar?: (valor: string) => void;
    atributosSelect?: Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'>;
  });

/** Campo con etiqueta (el mismo `campo` del panel original). */
export function Campo(props: PropsCampo) {
  let control: ReactNode;
  if (props.tipo === 'select') {
    const { etiqueta: _e, tipo: _t, valor = '', opciones, alCambiar, atributosSelect } = props;
    control = (
      <select value={String(valor)} onChange={(e) => alCambiar?.(e.target.value)} {...atributosSelect}>
        {opciones.map(([v, t]) => <option key={String(v)} value={String(v)}>{t}</option>)}
      </select>
    );
  } else if (props.tipo === 'number') {
    const { etiqueta: _e, tipo: _t, valor = '', alCambiar, ...resto } = props;
    control = <EntradaNumero valor={valor} alCambiar={alCambiar} {...resto} />;
  } else {
    const { etiqueta: _e, tipo = 'text', valor = '', alCambiar, ...resto } = props;
    control = <input type={tipo} value={valor} onChange={(e) => alCambiar?.(e.target.value)} {...resto} />;
  }
  return <label>{props.etiqueta}{control}</label>;
}


// -----------------------------------------------------------------------------
// 4. Casilla, deslizador y botones segmentados
// -----------------------------------------------------------------------------

/** Casilla de verificación con texto. */
export function Casilla({ texto, marcada = false, alCambiar, title }: { texto: ReactNode; marcada?: boolean; alCambiar?: (v: boolean) => void; title?: string }) {
  return (
    <label className="casilla" title={title}>
      <input type="checkbox" checked={marcada} onChange={(e) => alCambiar?.(e.target.checked)} />
      {' '}
      {texto}
    </label>
  );
}

/** Deslizador con su valor a la vista. `formato(valor)` arma el texto que se muestra. */
export function Deslizador({ etiqueta, valor, min, max, paso = 1, formato = String, alCambiar }: {
  etiqueta: ReactNode; valor: number; min: number; max: number; paso?: number;
  formato?: (v: number) => string; alCambiar?: (v: number) => void;
}) {
  return (
    <label className="deslizador">
      <span className="fila-entre">{etiqueta}<output>{formato(valor)}</output></span>
      <input type="range" min={min} max={max} step={paso} value={valor} onChange={(e) => alCambiar?.(Number(e.target.value))} />
    </label>
  );
}

/** Botones de opción única, uno al lado del otro. `opciones`: [[valor, texto], …]. */
export function Segmentado<T extends string | number>({ etiqueta, opciones, valor, alCambiar }: {
  etiqueta: string; opciones: ReadonlyArray<readonly [T, string]>; valor: T; alCambiar?: (v: T) => void;
}) {
  return (
    <div className="campo-segmentado">
      <span>{etiqueta}</span>
      <div className="segmentado" role="group" aria-label={etiqueta}>
        {opciones.map(([v, texto]) => (
          <button key={String(v)} type="button" aria-pressed={v === valor} onClick={() => alCambiar?.(v)}>{texto}</button>
        ))}
      </div>
    </div>
  );
}


// -----------------------------------------------------------------------------
// 5. Notas, avisos y números
// -----------------------------------------------------------------------------

/** Párrafo de ayuda en gris. */
export function Nota({ children, className }: { children?: ReactNode; className?: string }) {
  return <p className={className ? `nota ${className}` : 'nota'}>{children}</p>;
}

/** Número con separadores de miles (12.345). */
const FORMATO_NUMERO = new Intl.NumberFormat('es-CO');
export const numero = (n: number): string => FORMATO_NUMERO.format(n);

export interface EstadoAviso {
  texto: string;
  error: boolean;
}

/**
 * Mensaje temporal (se borra solo a los `duracionMs`). Devuelve [aviso, avisar].
 *   const [aviso, avisar] = useAviso();  …  avisar('Listo');  …  <Aviso aviso={aviso} />
 */
export function useAviso(duracionMs = 4500): [EstadoAviso, (texto: string, opciones?: { error?: boolean }) => void] {
  const [aviso, setAviso] = useState<EstadoAviso>({ texto: '', error: false });
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(temporizador.current), []);
  const avisar = useCallback((texto: string, { error = false }: { error?: boolean } = {}) => {
    setAviso({ texto, error });
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setAviso((a) => ({ ...a, texto: '' })), duracionMs);
  }, [duracionMs]);
  return [aviso, avisar];
}

/** El aviso en pantalla (div.aviso; en rojo si es un error). */
export function Aviso({ aviso, como = 'div' }: { aviso: EstadoAviso; como?: 'div' | 'span' }) {
  const Etiqueta = como;
  return <Etiqueta className={aviso.error ? 'aviso error' : 'aviso'} role="status">{aviso.texto}</Etiqueta>;
}
