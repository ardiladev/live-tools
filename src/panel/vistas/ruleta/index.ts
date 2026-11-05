// Vista provisional: se reemplaza al portar legado/js/panel/vistas/ruleta.js (ver vistas/tipos.ts).
import { vistaEnMigracion } from '../EnMigracion';

export const ruletaNormal = vistaEnMigracion('ruleta', 'Ruleta de regalos', 'Cada vez que alguien envía el regalo configurado, la ruleta gira en tu transmisión y sortea un premio.');
export const ruletaPremium = vistaEnMigracion('ruleta-premium', 'Ruleta premium', 'Una segunda ruleta, con su propio regalo (uno más caro) y premios más grandes. Va en otra fuente de OBS y gira sola, aparte de la normal.');
