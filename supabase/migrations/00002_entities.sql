-- Migration 00002: Entities (empresas del grupo)
--
-- Añade la tabla `entities` para scoping por empresa.
-- Actualiza `profiles` con entity_id y dni.
--
-- Aplicar en Supabase Dashboard > SQL Editor o con `supabase db push`.
-- Después: pnpm db:types

-- ─── Tabla entities ───────────────────────────────────────────────────────────

create table public.entities (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null unique,
  short_code  text not null unique,   -- "MAD", "STD" — para matching de PDFs
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

comment on table public.entities is
  'Empresas del grupo. Fuente de verdad para scoping de documentos, tablón y calendario laboral.';

-- ─── RLS entities ─────────────────────────────────────────────────────────────

alter table public.entities enable row level security;

-- Lectura: cualquier usuario autenticado
create policy "entities: authenticated read"
  on public.entities for select
  to authenticated
  using (true);

-- Escritura: solo admin
create policy "entities: admin write"
  on public.entities for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ─── Columnas en profiles ──────────────────────────────────────────────────────

alter table public.profiles
  add column entity_id uuid references public.entities(id) on delete set null,
  add column dni text unique;

create index idx_profiles_entity_id on public.profiles(entity_id);
create index idx_profiles_dni on public.profiles(dni);

comment on column public.profiles.entity_id is
  'Empresa del grupo a la que pertenece el empleado.';
comment on column public.profiles.dni is
  'DNI del empleado. Usado para matching automático de nóminas en importaciones batch.';
