// Ajustes → Cuenta → Conexión con TikTok (#/conexion). Ver VistaConexion.tsx.
import type { DefinicionVista } from '../tipos';
import { VistaConexion } from './VistaConexion';

export const conexion: DefinicionVista = {
  id: 'conexion',
  titulo: 'Conexión con TikTok',
  descripcion: 'La cuenta y la clave que usan todos los widgets. Si cambias el usuario, los widgets en OBS se pasan solos a la cuenta nueva; si cambias la clave, vuelve a copiar sus URLs.',
  Componente: VistaConexion,
};
