// Vista provisional: se reemplaza al portar legado/js/panel/vistas/metas.js (ver vistas/tipos.ts).
import { vistaEnMigracion } from '../EnMigracion';

export const metaLikes = vistaEnMigracion('meta-likes', 'Likes', 'Una barra de progreso que se llena con likes durante el LIVE. Cuenta desde que se abre la fuente en OBS.');
export const metaSeguidores = vistaEnMigracion('meta-follows', 'Seguidores', 'Una barra de progreso que se llena con seguidores durante el LIVE. Cuenta desde que se abre la fuente en OBS.');
export const metaCompartidos = vistaEnMigracion('meta-shares', 'Compartidos', 'Una barra de progreso que se llena con compartidos durante el LIVE. Cuenta desde que se abre la fuente en OBS.');
export const metaMonedas = vistaEnMigracion('meta-monedas', 'Monedas', 'Una barra de progreso que se llena con monedas durante el LIVE. Cuenta desde que se abre la fuente en OBS.');
