// Vista provisional: se reemplaza al portar legado/js/panel/vistas/conexion.js (ver vistas/tipos.ts).
import { vistaEnMigracion } from '../EnMigracion';

export const conexion = vistaEnMigracion('conexion', 'Conexión con TikTok', 'La cuenta y la clave que usan todos los widgets. Si cambias el usuario, los widgets en OBS se pasan solos a la cuenta nueva; si cambias la clave, vuelve a copiar sus URLs.');
