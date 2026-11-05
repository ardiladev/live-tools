// Vista provisional: se reemplaza al portar legado/js/panel/vistas/subathon.js (ver vistas/tipos.ts).
import { vistaEnMigracion } from '../EnMigracion';

export const subathon = vistaEnMigracion('subathon', 'Subathon', 'Un reloj que cuenta hacia atrás y al que tu público le suma tiempo con likes y regalos, hasta un tope. Cuando llega a 0, se acaba.');
export const extensible = vistaEnMigracion('extensible', 'Subathon extensible', 'El subathon con una meta: el público primero junta monedas (por ejemplo 1.000) y, desde que la cumple, cada regalo y cada tap extienden el reloj.');
