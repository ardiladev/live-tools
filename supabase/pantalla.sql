-- =============================================================================
-- pantalla.sql — Lo que muestran los widgets «Bailarinas en pantalla» y «Créditos finales»
--
-- Continúa supabase/bailarinas.sql (necesita su tabla `regalos_bailarinas`). Se ejecuta UNA vez
-- en el proyecto de Supabase: Dashboard → SQL Editor → pegar → Run. Se puede volver a ejecutar
-- sin problema (no borra datos).
--
-- El widget invisible registro.html anota los regalos de cada bailarina; leer ese registro
-- completo pide el secreto del panel. Estos widgets en OBS solo necesitan el RESUMEN del LIVE
-- actual, que es justo lo que se ve en pantalla: cuánto lleva cada bailarina y quiénes la
-- apoyan (sus mayores apoyos en las tarjetas; todos, en los créditos). Por eso esta lectura
-- solo pide conocer el id del registro, como leer_resultados (no devuelve horas, regalos ni
-- ids de cuentas).
--
-- Secciones: 1. Índice · 2. Leer el LIVE actual · 3. Permisos
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Índice: encontrar rápido el último regalo de un registro
-- -----------------------------------------------------------------------------

create index if not exists regalos_bailarinas_reciente on public.regalos_bailarinas (registro, hora desc);


-- -----------------------------------------------------------------------------
-- 2. El LIVE actual (la sesión del último regalo anotado)
-- -----------------------------------------------------------------------------
-- p_personas = cuántos apoyos devolver por bailarina (0 a 300; las tarjetas piden 3, los
-- créditos 300). Devuelve:
--   { sesion, desde, hasta (primer y último regalo, ms), ahora (hora del servidor, ms),
--     bailarinas: [{ b: id, m: monedas, p: personas, f: [[apodo, monedas], …] }] }
-- de la bailarina con más monedas a la de menos. Sin nada anotado: sesion = '' y bailarinas = [].
-- Una persona es su cuenta de TikTok (uid) o, si no se sabe, su apodo (igual que en el panel).

create or replace function public.leer_pantalla(p_registro text, p_personas integer default 3)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sesion text;
  v_n integer := least(300, greatest(0, coalesce(p_personas, 3)));
  v_ahora bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  select r.sesion into v_sesion
  from public.regalos_bailarinas r
  where r.registro = p_registro
  order by r.hora desc
  limit 1;

  if v_sesion is null then
    return jsonb_build_object('sesion', '', 'desde', 0, 'hasta', 0, 'ahora', v_ahora, 'bailarinas', '[]'::jsonb);
  end if;

  return (
    with filas as (
      select * from public.regalos_bailarinas
      where registro = p_registro and sesion = v_sesion
    ),
    personas as (
      select bailarina,
             coalesce(nullif(uid, ''), 'n:' || lower(usuario)) as persona,
             (array_agg(usuario order by hora desc))[1] as usuario,
             sum(monedas) as monedas
      from filas
      group by 1, 2
    ),
    puestos as (
      select *, row_number() over (partition by bailarina order by monedas desc, usuario) as puesto
      from personas
    ),
    totales as (
      select bailarina, round(sum(monedas), 2) as monedas, count(*) as personas
      from personas
      group by bailarina
    )
    select jsonb_build_object(
      'sesion', v_sesion,
      'desde', (select (extract(epoch from min(hora)) * 1000)::bigint from filas),
      'hasta', (select (extract(epoch from max(hora)) * 1000)::bigint from filas),
      'ahora', v_ahora,
      'bailarinas', coalesce((
        select jsonb_agg(jsonb_build_object(
          'b', t.bailarina,
          'm', t.monedas,
          'p', t.personas,
          'f', coalesce((
            select jsonb_agg(jsonb_build_array(x.usuario, round(x.monedas, 2)) order by x.puesto)
            from puestos x
            where x.bailarina = t.bailarina and x.puesto <= v_n
          ), '[]'::jsonb)
        ) order by t.monedas desc, t.bailarina)
        from totales t
      ), '[]'::jsonb)
    )
  );
end;
$$;


-- -----------------------------------------------------------------------------
-- 3. Permisos: solo la función
-- -----------------------------------------------------------------------------

revoke all on function public.leer_pantalla(text, integer) from public;
grant execute on function public.leer_pantalla(text, integer) to anon, authenticated;
