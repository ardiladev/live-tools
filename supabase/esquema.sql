-- =============================================================================
-- esquema.sql — Base de datos de Supabase para los "cambios en vivo" de Live Tools
--
-- Se ejecuta UNA vez en el proyecto de Supabase: Dashboard → SQL Editor → pegar → Run.
-- Se puede volver a ejecutar sin problema (no borra datos).
--
-- Idea: el panel guarda la configuración de cada widget en la tabla `widgets` y el widget,
-- abierto en OBS, la recibe al instante por Realtime. Así la URL se copia una sola vez.
--
-- Seguridad:
--   - Nadie lee ni escribe la tabla directamente (RLS activo y sin políticas).
--   - Solo existen dos puertas, las funciones `leer_widget` y `guardar_widget`:
--       leer_widget(id)                      → hay que conocer el id (va en la URL del widget)
--       guardar_widget(id, secreto, config)  → además hay que conocer el secreto (solo lo
--                                              tiene el navegador del panel)
--   - La API key de Euler Stream NUNCA se guarda aquí: sigue viajando solo en la URL.
--
-- Secciones: 1. Tabla · 2. Leer · 3. Guardar y avisar · 4. Permisos
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Tabla
-- -----------------------------------------------------------------------------

create table if not exists public.widgets (
  id          text primary key check (char_length(id) between 16 and 64),
  secreto     text not null check (char_length(secreto) between 16 and 128),
  config      jsonb not null check (octet_length(config::text) <= 20000),
  actualizado timestamptz not null default now()
);

comment on table public.widgets is 'Configuración de cada widget de Live Tools (la escribe el panel, la leen los widgets).';

alter table public.widgets enable row level security;
-- Sin políticas: con RLS activo, anon y authenticated no pueden tocar la tabla directamente.


-- -----------------------------------------------------------------------------
-- 2. Leer la configuración de un widget
-- -----------------------------------------------------------------------------

create or replace function public.leer_widget(p_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select config from public.widgets where id = p_id;
$$;


-- -----------------------------------------------------------------------------
-- 3. Guardar la configuración y avisar a los widgets abiertos
-- -----------------------------------------------------------------------------
-- La primera vez crea la fila con ese secreto; después solo deja cambiarla con el mismo
-- secreto. Al guardar, manda la configuración nueva por Realtime Broadcast al canal
-- público "widget-<id>", que es el que escucha el widget en OBS.

create or replace function public.guardar_widget(p_id text, p_secreto text, p_config jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.widgets (id, secreto, config)
  values (p_id, p_secreto, p_config)
  on conflict (id) do update
    set config = excluded.config, actualizado = now()
    where public.widgets.secreto = excluded.secreto;

  if not found then
    raise exception 'El secreto no corresponde a este widget' using errcode = '42501';
  end if;

  perform realtime.send(jsonb_build_object('config', p_config), 'config', 'widget-' || p_id, false);
end;
$$;


-- -----------------------------------------------------------------------------
-- 4. Permisos: solo las dos funciones, para cualquiera que tenga la clave pública
-- -----------------------------------------------------------------------------

revoke all on table public.widgets from anon, authenticated;
revoke all on function public.leer_widget(text) from public;
revoke all on function public.guardar_widget(text, text, jsonb) from public;
grant execute on function public.leer_widget(text) to anon, authenticated;
grant execute on function public.guardar_widget(text, text, jsonb) to anon, authenticated;
