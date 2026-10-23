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
--   - Cola de retos (secciones 5 a 8): los widgets SÍ pueden agregar retos (es lo único que
--     escriben), pero solo a una cola que exista (un widget guardado por el panel) y con
--     límites de tamaño. Marcarlos como hechos o vaciar la cola pide el secreto del panel.
--
-- Secciones: 1. Tabla · 2. Leer · 3. Guardar y avisar · 4. Permisos
--            5. Cola de retos: tabla · 6. Agregar · 7. Leer · 8. Marcar, vaciar y permisos
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


-- -----------------------------------------------------------------------------
-- 5. Cola de retos: tabla
-- -----------------------------------------------------------------------------
-- Cada reto pertenece a una cola, que es el id del widget "Cola de retos" (cola.html).
-- Los agregan la ruleta, el tragamonedas y la propia cola (retos por regalo) desde OBS, y el
-- panel a mano. El panel los marca como hechos (y puede deshacerlo).

create table if not exists public.retos (
  id        bigint generated always as identity primary key,
  cola      text not null references public.widgets (id) on delete cascade,
  usuario   text not null default '' check (char_length(usuario) <= 60),
  texto     text not null check (char_length(texto) between 1 and 200),
  origen    text not null default '' check (char_length(origen) <= 40),
  imagen    text not null default '' check (char_length(imagen) <= 600),
  cantidad  integer not null default 1 check (cantidad between 1 and 9999),
  hecho     timestamptz,             -- null = pendiente
  creado    timestamptz not null default now()
);

comment on table public.retos is 'Cola de retos pendientes de Live Tools (la llenan los widgets en OBS; el panel los marca como hechos).';

create index if not exists retos_cola_pendientes on public.retos (cola, id) where hecho is null;
create index if not exists retos_cola_hechos on public.retos (cola, hecho desc) where hecho is not null;

alter table public.retos enable row level security;
-- Sin políticas: solo se toca con las funciones de abajo.


-- Aviso a quien esté mirando la cola (el widget en OBS y el panel). Solo es una señal: los
-- retos se leen siempre con leer_retos.
create or replace function public.avisar_retos(p_cola text)
returns void
language sql
security definer
set search_path = ''
as $$
  select realtime.send('{}'::jsonb, 'retos', 'retos-' || p_cola, false);
$$;


-- -----------------------------------------------------------------------------
-- 6. Agregar un reto (lo pueden llamar los widgets: solo hace falta conocer el id de la cola)
-- -----------------------------------------------------------------------------

create or replace function public.agregar_reto(
  p_cola text, p_texto text, p_usuario text default '', p_origen text default '',
  p_imagen text default '', p_cantidad integer default 1
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  nuevo bigint;
begin
  if not exists (select 1 from public.widgets where id = p_cola) then
    raise exception 'Esa cola de retos no existe' using errcode = '42501';
  end if;
  -- Tope de pendientes: una cola llena no crece más (protege la base de datos).
  if (select count(*) from public.retos where cola = p_cola and hecho is null) >= 500 then
    raise exception 'La cola de retos está llena (500 pendientes)' using errcode = '54000';
  end if;

  insert into public.retos (cola, texto, usuario, origen, imagen, cantidad)
  values (
    p_cola,
    left(trim(coalesce(p_texto, '')), 200),
    left(trim(coalesce(p_usuario, '')), 60),
    left(trim(coalesce(p_origen, '')), 40),
    case when p_imagen ~ '^https://' then left(p_imagen, 600) else '' end,
    least(9999, greatest(1, coalesce(p_cantidad, 1)))
  )
  returning id into nuevo;

  -- Limpieza: los hechos de hace más de 2 días ya no se muestran.
  delete from public.retos where cola = p_cola and hecho < now() - interval '2 days';

  perform public.avisar_retos(p_cola);
  return nuevo;
end;
$$;


-- -----------------------------------------------------------------------------
-- 7. Leer la cola: pendientes (del más viejo al más nuevo) y los últimos hechos
-- -----------------------------------------------------------------------------

create or replace function public.leer_retos(p_cola text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'pendientes', coalesce((
      select jsonb_agg(to_jsonb(r) - 'cola' - 'hecho' order by r.id)
      from (select * from public.retos where cola = p_cola and hecho is null order by id limit 200) r
    ), '[]'::jsonb),
    'total', (select count(*) from public.retos where cola = p_cola and hecho is null),
    'hechos', coalesce((
      select jsonb_agg(to_jsonb(r) - 'cola' order by r.hecho desc)
      from (select * from public.retos where cola = p_cola and hecho is not null order by hecho desc limit 10) r
    ), '[]'::jsonb)
  );
$$;


-- -----------------------------------------------------------------------------
-- 8. Marcar como hecho (o deshacer) y vaciar: piden el secreto del panel
-- -----------------------------------------------------------------------------

create or replace function public.marcar_reto(p_cola text, p_secreto text, p_id bigint, p_hecho boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.widgets where id = p_cola and secreto = p_secreto) then
    raise exception 'El secreto no corresponde a esta cola' using errcode = '42501';
  end if;
  update public.retos
    set hecho = case when p_hecho then now() else null end
    where cola = p_cola and id = p_id;
  perform public.avisar_retos(p_cola);
end;
$$;

create or replace function public.vaciar_retos(p_cola text, p_secreto text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.widgets where id = p_cola and secreto = p_secreto) then
    raise exception 'El secreto no corresponde a esta cola' using errcode = '42501';
  end if;
  delete from public.retos where cola = p_cola;
  perform public.avisar_retos(p_cola);
end;
$$;

revoke all on table public.retos from anon, authenticated;
revoke all on function public.avisar_retos(text) from public, anon, authenticated;
revoke all on function public.agregar_reto(text, text, text, text, text, integer) from public;
revoke all on function public.leer_retos(text) from public;
revoke all on function public.marcar_reto(text, text, bigint, boolean) from public;
revoke all on function public.vaciar_retos(text, text) from public;
grant execute on function public.agregar_reto(text, text, text, text, text, integer) to anon, authenticated;
grant execute on function public.leer_retos(text) to anon, authenticated;
grant execute on function public.marcar_reto(text, text, bigint, boolean) to anon, authenticated;
grant execute on function public.vaciar_retos(text, text) to anon, authenticated;
