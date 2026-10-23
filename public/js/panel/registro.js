// =============================================================================
// registro.js — Mapa del panel: categorías (íconos de la izquierda) → grupos → vistas
//
// El menú, la navegación y los íconos se arman solos a partir de esta lista.
//
// Una vista es un objeto:
//   { id, titulo, descripcion, render({ senal }) → [nodos] }
// `id` es la dirección (#/id) y debe ser único. `senal` es un AbortSignal que se cancela
// al salir de la vista: úsalo para suscripciones y addEventListener.
//
// Para agregar una función nueva:
//   1. Crea su vista en js/panel/vistas/ (copia una parecida, por ejemplo alertas.js).
//   2. Si es un widget para OBS: su .html en public/, su CSS en css/widgets/ y su
//      lógica en js/widgets/ (copia los de alertas). En su vista, regístralo con
//      sincronizar.registrar(id, { config, validar }) para que tenga cambios en vivo.
//   3. Agrégala aquí, en el grupo que corresponda (o en un grupo o categoría nuevos).
//      Íconos disponibles: ver ICONOS en js/panel/ui.js.
// =============================================================================

import { ruletaNormal, ruletaPremium } from './vistas/ruleta.js';
import tragamonedas from './vistas/tragamonedas.js';
import carrera from './vistas/carrera.js';
import marcador from './vistas/marcador.js';
import batalla from './vistas/batalla.js';
import jefe from './vistas/jefe.js';
import boveda from './vistas/boveda.js';
import subathon from './vistas/subathon.js';
import repertorio from './vistas/repertorio.js';
import cola from './vistas/cola.js';
import { metaLikes, metaSeguidores, metaCompartidos, metaMonedas } from './vistas/metas.js';
import alertas from './vistas/alertas.js';
import destacado from './vistas/destacado.js';
import trono from './vistas/trono.js';
import actividad from './vistas/actividad.js';
import buscadorRegalos from './vistas/regalos.js';
import conexion from './vistas/conexion.js';

// Organización por propósito (2026-10-13):
//   Juegos           → la persona en vivo y el público juegan: sorteos al azar, competencias
//                      entre integrantes o equipos, y retos que el público desbloquea.
//   Superposiciones  → lo que acompaña el LIVE sin ser un juego: metas, alertas y reconocimiento
//                      a quien apoya.
// Los ids de las vistas no cambian (son la dirección #/id y la clave de lo guardado).
export const CATEGORIAS = [
  {
    id: 'juegos',
    titulo: 'Juegos',
    corto: 'Juegos',
    icono: 'juegos',
    grupos: [
      { id: 'sorteos', titulo: 'Sorteos', vistas: [ruletaNormal, ruletaPremium, tragamonedas] },
      { id: 'competencias', titulo: 'Competencias', vistas: [carrera, marcador, batalla] },
      { id: 'retos', titulo: 'Retos del público', vistas: [cola, jefe, boveda, subathon, repertorio] },
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
      { id: 'regalos', titulo: 'Regalos', vistas: [buscadorRegalos] },
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

/** Busca una vista por id y devuelve también su categoría y grupo. */
export function buscarVista(id) {
  for (const categoria of CATEGORIAS) {
    for (const grupo of categoria.grupos) {
      const vista = grupo.vistas.find((v) => v.id === id);
      if (vista) return { categoria, grupo, vista };
    }
  }
  return null;
}
