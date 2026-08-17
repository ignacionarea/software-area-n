-- =========================================================
-- ESQUEMA COMPLETO DE BASE DE DATOS PARA AREA N COTIZADOR
-- Ejecutar en el SQL Editor de Supabase (https://supabase.com)
-- =========================================================

-- 1. Extensiones necesarias
create extension if not exists "uuid-ossp";

-- 2. Tipos y Enums
do $$ begin
  create type estado_cotizacion as enum ('borrador', 'enviada', 'aceptada', 'rechazada', 'vencida');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type moneda as enum ('ARS', 'USD');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type ppd_estado as enum ('borrador', 'descartado', 'convertido');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type tipo_item as enum ('producto', 'mano_obra');
exception
  when duplicate_object then null;
end $$;

-- 3. Tabla: Clientes
create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  cuit_dni text,
  direccion text,
  telefono text,
  email text,
  created_at timestamptz not null default now()
);

-- 4. Tabla: Configuración (Fila única)
create table if not exists configuracion (
  id boolean primary key default true check (id = true),
  razon_social text not null default 'Area N',
  cuit text,
  condicion_iva text not null default 'Responsable Inscripto',
  categoria_afip text,
  direccion text,
  telefono text,
  email text,
  fecha_inicio_actividad text,
  banco text,
  cbu_alias text,
  validez_default_dias integer not null default 15,
  comision_porcentaje numeric not null default 15,
  texto_legal_pdf text default 'Los precios están sujetos a variación según el tipo de cambio oficial del día de pago.',
  condiciones_pago text default '50% de anticipo para reserva de equipos, 50% contra entrega e instalación.',
  updated_at timestamptz not null default now()
);

-- 5. Tabla: Productos
create table if not exists productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  marca text not null default 'Sonoff',
  categoria text,
  descripcion text,
  precio_origen numeric not null default 0,
  moneda_origen moneda not null default 'ARS',
  sku text,
  url text,
  imagen_url text,
  es_manual boolean not null default false,
  activo boolean not null default true,
  variantes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6. Secuencia y Tabla: Cotizaciones
create sequence if not exists cotizaciones_numero_seq start with 88;

create table if not exists cotizaciones (
  id uuid primary key default gen_random_uuid(),
  numero integer not null default nextval('cotizaciones_numero_seq') unique,
  cliente_id uuid references clientes(id) on delete set null,
  fecha_emision date not null default current_date,
  validez_dias integer not null default 15,
  cotizacion_dolar numeric not null default 1000,
  estado estado_cotizacion not null default 'borrador',
  notas text,
  enviada_a text,
  enviada_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 7. Tabla: Items de Cotización
create table if not exists items_cotizacion (
  id uuid primary key default gen_random_uuid(),
  cotizacion_id uuid not null references cotizaciones(id) on delete cascade,
  producto_id uuid references productos(id) on delete set null,
  concepto text not null,
  tipo tipo_item not null default 'producto',
  cantidad numeric not null default 1,
  precio_unitario_ars numeric not null default 0,
  precio_unitario_usd numeric not null default 0,
  url_producto text,
  orden integer not null default 0,
  created_at timestamptz not null default now()
);

-- 8. Tabla: PPD Proyectos (Para Pensar y Diseñar)
create table if not exists ppd_proyectos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descripcion text,
  cliente_id uuid references clientes(id) on delete set null,
  cotizacion_id uuid references cotizaciones(id) on delete set null,
  direccion_proyecto text,
  tecnico_relevador text,
  fecha_relevamiento date default current_date,
  estado ppd_estado not null default 'borrador',
  items jsonb not null default '[]'::jsonb,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 9. Tabla: Scrape Sources (Fuentes de sincronización de catálogo)
create table if not exists scrape_sources (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  nombre text not null,
  platform text not null default 'tiendanube',
  url_base text not null,
  max_pages integer not null default 10,
  activo boolean not null default true,
  last_run_at timestamptz,
  last_run_count integer,
  last_run_ok boolean,
  last_run_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- VISTAS (VIEWS)
-- =========================================================

-- Vista: v_cotizaciones_resumen
create or replace view v_cotizaciones_resumen as
select 
  c.id,
  c.numero,
  to_char(c.numero, 'FM0000') as numero_formateado,
  c.fecha_emision::text as fecha_emision,
  (c.fecha_emision + (c.validez_dias || ' days')::interval)::date::text as fecha_vencimiento,
  c.validez_dias,
  c.estado,
  c.cotizacion_dolar,
  c.cliente_id,
  cl.nombre as cliente_nombre,
  cl.email as cliente_email,
  count(i.id)::int as cantidad_items,
  coalesce(sum(i.cantidad * i.precio_unitario_ars), 0)::numeric as total_ars,
  coalesce(sum(i.cantidad * i.precio_unitario_usd), 0)::numeric as total_usd,
  c.created_at::text as created_at,
  c.updated_at::text as updated_at
from cotizaciones c
left join clientes cl on cl.id = c.cliente_id
left join items_cotizacion i on i.cotizacion_id = c.id
group by c.id, c.numero, c.fecha_emision, c.validez_dias, c.estado, c.cotizacion_dolar, c.cliente_id, cl.nombre, cl.email, c.created_at, c.updated_at;

-- Vista: v_clientes_resumen
create or replace view v_clientes_resumen as
select
  cl.id,
  cl.nombre,
  cl.telefono,
  cl.email,
  cl.direccion,
  cl.cuit_dni,
  cl.created_at::text as created_at,
  count(c.id)::int as total_cotizaciones,
  count(c.id) filter (where c.estado = 'aceptada')::int as cotizaciones_aceptadas
from clientes cl
left join cotizaciones c on c.cliente_id = cl.id
group by cl.id, cl.nombre, cl.telefono, cl.email, cl.direccion, cl.cuit_dni, cl.created_at;

-- Vista: v_dashboard_mensual
create or replace view v_dashboard_mensual as
select
  to_char(c.fecha_emision, 'YYYY-MM') as mes,
  count(c.id) filter (where c.estado = 'enviada')::int as enviadas,
  count(c.id) filter (where c.estado = 'aceptada')::int as aceptadas,
  count(c.id) filter (where c.estado = 'rechazada')::int as rechazadas,
  count(c.id) filter (where c.estado = 'vencida')::int as vencidas,
  case 
    when count(c.id) filter (where c.estado in ('enviada', 'aceptada', 'rechazada', 'vencida')) > 0 
    then round((count(c.id) filter (where c.estado = 'aceptada')::numeric / count(c.id) filter (where c.estado in ('enviada', 'aceptada', 'rechazada', 'vencida'))::numeric * 100), 1)
    else 0
  end as conversion_rate_pct,
  coalesce(sum(i.cantidad * i.precio_unitario_ars) filter (where c.estado = 'aceptada'), 0)::numeric as plata_movida_ars,
  (
    coalesce(sum(i.cantidad * i.precio_unitario_ars * (conf.comision_porcentaje / 100.0)) filter (where c.estado = 'aceptada' and i.tipo = 'producto'), 0)
    + coalesce(sum(i.cantidad * i.precio_unitario_ars) filter (where c.estado = 'aceptada' and i.tipo = 'mano_obra'), 0)
  )::numeric as ganancia_ars,
  coalesce(sum(i.cantidad * i.precio_unitario_ars) filter (where c.estado = 'aceptada' and i.tipo = 'mano_obra'), 0)::numeric as mano_obra_ars,
  coalesce(sum(i.cantidad * i.precio_unitario_ars * (conf.comision_porcentaje / 100.0)) filter (where c.estado = 'aceptada' and i.tipo = 'producto'), 0)::numeric as comisiones_ars
from cotizaciones c
left join items_cotizacion i on i.cotizacion_id = c.id
cross join configuracion conf
where conf.id = true
group by to_char(c.fecha_emision, 'YYYY-MM'), conf.comision_porcentaje;

-- =========================================================
-- FUNCIONES RPC
-- =========================================================

create or replace function marcar_cotizaciones_vencidas()
returns int
language plpgsql
security definer
as $$
declare
  affected_rows int;
begin
  update cotizaciones
  set estado = 'vencida', updated_at = now()
  where estado = 'enviada'
    and (fecha_emision + (validez_dias || ' days')::interval) < current_date;
  get diagnostics affected_rows = row_count;
  return affected_rows;
end;
$$;

-- =========================================================
-- DATOS INICIALES (SEEDS)
-- =========================================================

insert into configuracion (id, razon_social, condicion_iva, validez_default_dias, comision_porcentaje)
values (true, 'Area N Domótica', 'Responsable Inscripto', 15, 15)
on conflict (id) do nothing;

insert into scrape_sources (slug, nombre, platform, url_base, activo)
values 
  ('sonoff', 'Sonoff Oficial Argentina', 'tiendanube', 'https://sonoff.com.ar', true),
  ('demasled', 'Demasled Argentina', 'custom', 'https://demasled.com.ar', true)
on conflict (slug) do nothing;

-- =========================================================
-- PERMISOS Y ROW LEVEL SECURITY (RLS)
-- =========================================================

alter table configuracion enable row level security;
alter table clientes enable row level security;
alter table productos enable row level security;
alter table cotizaciones enable row level security;
alter table items_cotizacion enable row level security;
alter table ppd_proyectos enable row level security;
alter table scrape_sources enable row level security;

-- Permitir lectura y escritura a usuarios autenticados
create policy "Allow all authenticated users" on configuracion for all to authenticated using (true) with check (true);
create policy "Allow all authenticated users" on clientes for all to authenticated using (true) with check (true);
create policy "Allow all authenticated users" on productos for all to authenticated using (true) with check (true);
create policy "Allow all authenticated users" on cotizaciones for all to authenticated using (true) with check (true);
create policy "Allow all authenticated users" on items_cotizacion for all to authenticated using (true) with check (true);
create policy "Allow all authenticated users" on ppd_proyectos for all to authenticated using (true) with check (true);
create policy "Allow all authenticated users" on scrape_sources for all to authenticated using (true) with check (true);

-- Permitir también acceso anónimo durante la inicialización
create policy "Allow anon access" on configuracion for all to anon using (true) with check (true);
create policy "Allow anon access" on clientes for all to anon using (true) with check (true);
create policy "Allow anon access" on productos for all to anon using (true) with check (true);
create policy "Allow anon access" on cotizaciones for all to anon using (true) with check (true);
create policy "Allow anon access" on items_cotizacion for all to anon using (true) with check (true);
create policy "Allow anon access" on ppd_proyectos for all to anon using (true) with check (true);
create policy "Allow anon access" on scrape_sources for all to anon using (true) with check (true);
