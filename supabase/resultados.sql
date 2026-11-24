-- =============================================================================
-- resultados.sql — Resultados de las rondas de los juegos (para el Torneo por llaves)
--
-- Continúa supabase/esquema.sql (necesita su tabla `widgets`). Se ejecuta UNA vez en el
-- proyecto de Supabase: Dashboard → SQL Editor → pegar → Run. Se puede volver a ejecutar.
--
-- El panel no ve los puntos de los juegos (solo los cuenta el widget en OBS). Para que el Torneo
-- por llaves sepa quién ganó cada Duelo VS, el widget anota aquí el resultado de cada ronda al
-- terminar (ganador y puntos). Como la cola de retos, es un widget que ESCRIBE, pero solo para
-- un widget que exista, una fila por ronda (si la vuelve a mandar, se reemplaza) y con límites.
-- Leer los resultados solo pide conocer el id del widget (no hay nada privado: es lo mismo que
-- se ve en pantalla).
--
-- Secciones: 1. Tabla · 2. Anotar · 3. Leer · 4. Permisos
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Tabla
-- -----------------------------------------------------------------------------

create table if not exists public.resultados (
  widget  text not null references public.widgets (id) on delete cascade,
  ronda   bigint not null,
  -- { g: ganador (0, 1… o -1 = empate), p: [puntos de cada equipo] }
  datos   jsonb not null check (octet_length(datos::text) <= 2000),
  creado  timestamptz not null default now(),
  primary key (widget, ronda)
);

comment on table public.resultados is 'Resultado de cada ronda de los juegos de Live Tools (lo anota el widget en OBS al terminar).';

alter table public.resultados enable row level security;
-- Sin políticas: solo se toca con las funciones de abajo.


-- -----------------------------------------------------------------------------
-- 2. Anotar el resultado de una ronda (lo llama el widget)
-- -----------------------------------------------------------------------------

create or replace function public.anotar_resultado(p_widget text, p_ronda bigint, p_datos jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.widgets where id = p_widget) then
    raise exception 'Ese widget no existe' using errcode = '42501';
  end if;
  insert into public.resultados (widget, ronda, datos)
  values (p_widget, p_ronda, p_datos)
  on conflict (widget, ronda) do update set datos = excluded.datos, creado = now();
  -- Limpieza: solo se guardan los 200 resultados más recientes de cada widget.
  delete from public.resultados
  where widget = p_widget and ronda not in (
    select ronda from public.resultados where widget = p_widget order by creado desc limit 200
  );
end;
$$;


-- -----------------------------------------------------------------------------
-- 3. Leer los últimos resultados de un widget ([{ ronda, datos, creado }], del más nuevo)
-- -----------------------------------------------------------------------------

create or replace function public.leer_resultados(p_widget text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('ronda', r.ronda, 'datos', r.datos, 'creado', r.creado) order by r.creado desc), '[]'::jsonb)
  from (select * from public.resultados where widget = p_widget order by creado desc limit 50) r;
$$;


-- -----------------------------------------------------------------------------
-- 4. Permisos: solo las funciones
-- -----------------------------------------------------------------------------

revoke all on table public.resultados from anon, authenticated;
revoke all on function public.anotar_resultado(text, bigint, jsonb) from public;
revoke all on function public.leer_resultados(text) from public;
grant execute on function public.anotar_resultado(text, bigint, jsonb) to anon, authenticated;
grant execute on function public.leer_resultados(text) to anon, authenticated;
