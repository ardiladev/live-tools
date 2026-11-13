// =============================================================================
// panel/rutas.ts — Mapa del panel: categorías (íconos de la izquierda) → grupos → vistas
//
// El riel, el menú y la navegación (#/id-de-la-vista) se arman solos a partir de esta lista.
// Importar una vista también registra la configuración de su widget en sincronizar (ver
// vistas/tipos.ts): por eso se importan TODAS aquí, aunque no estén abiertas.
//
// Organización por propósito (2026-10-13):
//   Juegos           → la persona en vivo y el público juegan: sorteos al azar, competencias
//                      entre integrantes o equipos, y retos que el público desbloquea.
//   Superposiciones  → lo que acompaña el LIVE sin ser un juego: metas, alertas y reconocimiento.
// Los ids de las vistas no cambian (son la dirección #/id y la clave de lo guardado).
//
// Para agregar una función nueva: crea su carpeta en vistas/ (copia una parecida, p. ej.
// vistas/carrera) y, si es un widget, su carpeta en src/widgets/ y su .html en la raíz (más
// su nombre en PAGINAS de vite.config.ts). Luego agrégala aquí, en el grupo que corresponda.
// =============================================================================

import type { NombreIcono } from './componentes/ui';
import { activacion } from './vistas/activacion';
import { actividad } from './vistas/actividad';
import { alertas } from './vistas/alertas';
import { batalla } from './vistas/batalla';
import { boveda } from './vistas/boveda';
import { carrera } from './vistas/carrera';
import { cola } from './vistas/cola';
import { conexion } from './vistas/conexion';
import { destacado } from './vistas/destacado';
import { duelo } from './vistas/duelo';
import { jefe } from './vistas/jefe';
import { marcador } from './vistas/marcador';
import { metaCompartidos, metaLikes, metaMonedas, metaSeguidores } from './vistas/metas';
import { regalos } from './vistas/regalos';
import { repertorio } from './vistas/repertorio';
import { ruletaNormal, ruletaPremium } from './vistas/ruleta';
import { extensible, subathon } from './vistas/subathon';
import type { DefinicionVista } from './vistas/tipos';
import { tragamonedas } from './vistas/tragamonedas';
import { trono } from './vistas/trono';

export interface Grupo {
  id: string;
  titulo: string;
  vistas: DefinicionVista[];
}

export interface Categoria {
  id: string;
  titulo: string;
  corto: string;
  icono: NombreIcono;
  grupos: Grupo[];
}

export const CATEGORIAS: Categoria[] = [
  {
    id: 'juegos',
    titulo: 'Juegos',
    corto: 'Juegos',
    icono: 'juegos',
    grupos: [
      { id: 'sorteos', titulo: 'Sorteos', vistas: [ruletaNormal, ruletaPremium, tragamonedas] },
      { id: 'competencias', titulo: 'Competencias', vistas: [carrera, marcador, batalla, activacion, duelo] },
      { id: 'retos', titulo: 'Retos del público', vistas: [cola, jefe, boveda, subathon, extensible, repertorio] },
    ],
  },
  {
    id: 'superposiciones',
    titulo: 'Superposiciones',
    corto: 'Superpos.',
    icono: 'monitor',
    grupos: [
      { id: 'metas', titulo: 'Metas', vistas: [metaLikes, metaSeguidores, metaCompartidos, metaMonedas] },
      { id: 'alertas', titulo: 'Alertas', vistas: [alertas] },
      { id: 'reconocimiento', titulo: 'Reconocimiento', vistas: [destacado, trono] },
    ],
  },
  {
    id: 'actividad',
    titulo: 'Actividad',
    corto: 'Actividad',
    icono: 'pulso',
    grupos: [
      { id: 'envivo', titulo: 'En vivo', vistas: [actividad] },
      { id: 'regalos', titulo: 'Regalos', vistas: [regalos] },
    ],
  },
  {
    id: 'ajustes',
    titulo: 'Ajustes',
    corto: 'Ajustes',
    icono: 'ajustes',
    grupos: [
      { id: 'cuenta', titulo: 'Cuenta', vistas: [conexion] },
    ],
  },
];

export const VISTA_INICIAL = 'ruleta';

export interface Ubicacion {
  categoria: Categoria;
  grupo: Grupo;
  vista: DefinicionVista;
}

/** Busca una vista por id y devuelve también su categoría y grupo. */
export function buscarVista(id: string): Ubicacion | null {
  for (const categoria of CATEGORIAS) {
    for (const grupo of categoria.grupos) {
      const vista = grupo.vistas.find((v) => v.id === id);
      if (vista) return { categoria, grupo, vista };
    }
  }
  return null;
}
