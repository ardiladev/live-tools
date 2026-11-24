-- =============================================================================
-- bailarinas.sql — Base de datos de Supabase para las BAILARINAS de Live Tools
--
-- Continúa supabase/esquema.sql (necesita su tabla `widgets`). Se ejecuta UNA vez en el
-- proyecto de Supabase: Dashboard → SQL Editor → pegar → Run. Se puede volver a ejecutar sin
-- problema (no borra datos).
--
-- El panel registra a las bailarinas (nombre, color, regalo activador y foto). La foto se
-- guarda aquí (tabla `fotos`) para que los widgets en OBS / LIVE Studio la puedan mostrar: la
-- configuración de un widget no puede llevarla (máximo 20.000 bytes).
-- El widget invisible "Registro de bailarinas" (registro.html) anota cada regalo que le
-- corresponde a cada una (tabla `regalos_bailarinas`): como la cola de retos, es un widget que
-- ESCRIBE, pero solo en un registro que exista (el id de su propio widget) y con límites.
-- Leer el registro, borrar un LIVE y guardar o borrar fotos piden el secreto del panel.
--
-- Secciones: 1. Fotos · 2. Registro de regalos: tabla · 3. Anotar · 4. Leer y borrar
--            5. Permisos
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Fotos de las bailarinas (una imagen pequeña, ya recortada por el panel)
-- -----------------------------------------------------------------------------

create table if not exists public.fotos (
  id          text primary key check (char_length(id) between 8 and 64),
  registro    text not null references public.widgets (id) on delete cascade,
  datos       text not null check (char_length(datos) <= 200000 and datos ~ '^data:image/(webp|jpeg|png);base64,'),
  actualizado timestamptz not null default now()
);

comment on table public.fotos is 'Fotos de las bailarinas de Live Tools (las sube el panel, las leen los widgets).';

alter table public.fotos enable row level security;
-- Sin políticas: solo se toca con las funciones de abajo.

create or replace function public.guardar_foto(p_registro text, p_secreto text, p_id text, p_datos text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.widgets where id = p_registro and secreto = p_secreto) then
    raise exception 'El secreto no corresponde a este registro' using errcode = '42501';
  end if;
  -- Tope: 300 fotos por registro (protege la base de datos).
  if (select count(*) from public.fotos where registro = p_registro and id <> p_id) >= 300 then
    raise exception 'Hay demasiadas fotos guardadas (300)' using errcode = '54000';
  end if;
  insert into public.fotos (id, registro, datos)
  values (p_id, p_registro, p_datos)
  on conflict (id) do update
    set datos = excluded.datos, actualizado = now()
    where public.fotos.registro = excluded.registro;
end;
$$;

create or replace function public.borrar_foto(p_registro text, p_secreto text, p_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.widgets where id = p_registro and secreto = p_secreto) then
    raise exception 'El secreto no corresponde a este registro' using errcode = '42501';
  end if;
  delete from public.fotos where id = p_id and registro = p_registro;
end;
$$;

-- Las fotos pedidas { id: datos } (hasta 24 a la vez). Hay que conocer el id de cada foto.
create or replace function public.leer_fotos(p_ids text[])
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(id, datos), '{}'::jsonb)
  from public.fotos
  where id = any (p_ids[1:24]);
$$;


-- -----------------------------------------------------------------------------
-- 2. Registro de regalos de cada bailarina: tabla
-- -----------------------------------------------------------------------------
-- Una fila por regalo y por bailarina. Si el regalo era para un equipo de varias bailarinas,
-- hay una fila para cada una con su parte (`monedas` = `total` / `partes`).
-- `sesion` = un LIVE (la pone el widget: cambia tras 2 horas sin regalos o al pedirlo el panel).
-- `id` lo pone el widget: si reintenta el envío, la fila no se repite.

create table if not exists public.regalos_bailarinas (
  id         text primary key check (char_length(id) between 8 and 48),
  registro   text not null references public.widgets (id) on delete cascade,
  sesion     text not null check (char_length(sesion) between 1 and 40),
  bailarina  text not null check (char_length(bailarina) between 1 and 40),
  nombre     text not null default '' check (char_length(nombre) <= 40),
  usuario    text not null default '' check (char_length(usuario) <= 60),
  uid        text not null default '' check (char_length(uid) <= 40),
  gift_id    text not null default '' check (char_length(gift_id) <= 40),
  regalo     text not null default '' check (char_length(regalo) <= 60),
  cantidad   integer not null check (cantidad between 1 and 100000),
  monedas    numeric(16, 4) not null check (monedas between 0 and 1000000000),
  total      numeric(16, 2) not null check (total between 0 and 1000000000),
  partes     smallint not null default 1 check (partes between 1 and 20),
  origen     text not null default 'apoyo' check (origen in ('activador', 'equipo', 'apoyo')),
  hora       timestamptz not null,
  creado     timestamptz not null default now()
);

comment on table public.regalos_bailarinas is 'Regalos que le corresponden a cada bailarina (los anota el widget registro.html desde OBS).';

create index if not exists regalos_bailarinas_sesion on public.regalos_bailarinas (registro, sesion, hora);

alter table public.regalos_bailarinas enable row level security;
-- Sin políticas: solo se toca con las funciones de abajo.


-- -----------------------------------------------------------------------------
-- 3. Anotar regalos (lo llama el widget: solo hace falta el id del registro)
-- -----------------------------------------------------------------------------
-- p_filas = [{ id, s sesión, b bailarina, bn nombre, u usuario, uid, g id del regalo, gn nombre
-- del regalo, n cantidad, m monedas de esta bailarina, p monedas del regalo completo, k partes,
-- o origen, h hora (ms) }] (hasta 200 por llamada). Devuelve cuántas filas nuevas quedaron.

create or replace function public.anotar_regalos(p_registro text, p_filas jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  nuevas integer;
begin
  if not exists (select 1 from public.widgets where id = p_registro) then
    raise exception 'Ese registro de bailarinas no existe' using errcode = '42501';
  end if;
  if jsonb_typeof(p_filas) is distinct from 'array' or jsonb_array_length(p_filas) > 200 then
    raise exception 'Se mandan de 0 a 200 regalos a la vez' using errcode = '22023';
  end if;

  insert into public.regalos_bailarinas
    (id, registro, sesion, bailarina, nombre, usuario, uid, gift_id, regalo, cantidad, monedas, total, partes, origen, hora)
  select
    left(x.id, 48), p_registro, left(x.s, 40), left(x.b, 40),
    left(coalesce(x.bn, ''), 40), left(coalesce(x.u, ''), 60), left(coalesce(x.uid, ''), 40),
    left(coalesce(x.g, ''), 40), left(coalesce(x.gn, ''), 60),
    least(100000, greatest(1, coalesce(x.n, 1))),
    least(1000000000, greatest(0, coalesce(x.m, 0))),
    least(1000000000, greatest(0, coalesce(x.p, 0))),
    least(20, greatest(1, coalesce(x.k, 1))),
    case when x.o in ('activador', 'equipo', 'apoyo') then x.o else 'apoyo' end,
    -- La hora del widget (sirve si mandó tarde, tras un corte), pero nunca del futuro ni de hace más de 2 días.
    least(now(), greatest(now() - interval '2 days', coalesce(to_timestamp(x.h / 1000.0), now())))
  from jsonb_to_recordset(p_filas) as x(
    id text, s text, b text, bn text, u text, uid text, g text, gn text,
    n integer, m numeric, p numeric, k integer, o text, h bigint
  )
  where char_length(coalesce(x.id, '')) >= 8 and coalesce(x.s, '') <> '' and coalesce(x.b, '') <> ''
  on conflict (id) do nothing;

  get diagnostics nuevas = row_count;
  return nuevas;
end;
$$;


-- -----------------------------------------------------------------------------
-- 4. Leer el registro y borrar un LIVE (piden el secreto del panel)
-- -----------------------------------------------------------------------------

-- Los LIVE (sesiones) del registro, del más reciente al más viejo (hasta 300), con su resumen.
create or replace function public.leer_sesiones(p_registro text, p_secreto text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.widgets where id = p_registro and secreto = p_secreto) then
    raise exception 'El secreto no corresponde a este registro' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'sesion', s.sesion,
      'desde', (extract(epoch from s.desde) * 1000)::bigint,
      'hasta', (extract(epoch from s.hasta) * 1000)::bigint,
      'monedas', s.monedas, 'filas', s.filas, 'personas', s.personas
    ) order by s.desde desc)
    from (
      select sesion, min(hora) as desde, max(hora) as hasta, round(sum(monedas), 2) as monedas,
             count(*) as filas, count(distinct coalesce(nullif(uid, ''), usuario)) as personas
      from public.regalos_bailarinas
      where registro = p_registro
      group by sesion
      order by min(hora) desc
      limit 300
    ) s
  ), '[]'::jsonb);
end;
$$;

-- Las filas de los LIVE pedidos (hasta 31 a la vez y 60.000 filas), en orden de hora, como
-- arreglos compactos: [id, sesión, bailarina, nombre, usuario, uid, gift_id, regalo, cantidad,
-- monedas, total, partes, origen, hora en ms].
create or replace function public.leer_registro(p_registro text, p_secreto text, p_sesiones text[])
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.widgets where id = p_registro and secreto = p_secreto) then
    raise exception 'El secreto no corresponde a este registro' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_array(
      r.id, r.sesion, r.bailarina, r.nombre, r.usuario, r.uid, r.gift_id, r.regalo, r.cantidad,
      r.monedas, r.total, r.partes, r.origen, (extract(epoch from r.hora) * 1000)::bigint
    ) order by r.hora, r.id)
    from (
      select * from public.regalos_bailarinas
      where registro = p_registro and sesion = any (p_sesiones[1:31])
      order by hora, id
      limit 60000
    ) r
  ), '[]'::jsonb);
end;
$$;

-- Borra un LIVE completo (por ejemplo, el de las pruebas). Devuelve cuántas filas borró.
create or replace function public.borrar_sesion(p_registro text, p_secreto text, p_sesion text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  borradas integer;
begin
  if not exists (select 1 from public.widgets where id = p_registro and secreto = p_secreto) then
    raise exception 'El secreto no corresponde a este registro' using errcode = '42501';
  end if;
  delete from public.regalos_bailarinas where registro = p_registro and sesion = p_sesion;
  get diagnostics borradas = row_count;
  return borradas;
end;
$$;


-- -----------------------------------------------------------------------------
-- 5. Permisos: solo las funciones
-- -----------------------------------------------------------------------------

revoke all on table public.fotos from anon, authenticated;
revoke all on table public.regalos_bailarinas from anon, authenticated;
revoke all on function public.guardar_foto(text, text, text, text) from public;
revoke all on function public.borrar_foto(text, text, text) from public;
revoke all on function public.leer_fotos(text[]) from public;
revoke all on function public.anotar_regalos(text, jsonb) from public;
revoke all on function public.leer_sesiones(text, text) from public;
revoke all on function public.leer_registro(text, text, text[]) from public;
revoke all on function public.borrar_sesion(text, text, text) from public;
grant execute on function public.guardar_foto(text, text, text, text) to anon, authenticated;
grant execute on function public.borrar_foto(text, text, text) to anon, authenticated;
grant execute on function public.leer_fotos(text[]) to anon, authenticated;
grant execute on function public.anotar_regalos(text, jsonb) to anon, authenticated;
grant execute on function public.leer_sesiones(text, text) to anon, authenticated;
grant execute on function public.leer_registro(text, text, text[]) to anon, authenticated;
grant execute on function public.borrar_sesion(text, text, text) to anon, authenticated;
