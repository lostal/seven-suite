-- Migration 00005: Configuración y módulos por entidad
-- Prerequisito: 00002_entities.sql (entities table)
-- Después: pnpm db:types

-- ─── Módulos habilitados por entidad ─────────────────────────────────────────
-- Qué módulos tiene activos cada sede (parking, oficinas, visitantes, etc.)

create table public.entity_modules (
  entity_id  uuid not null references public.entities(id) on delete cascade,
  module     text not null
    check (module in ('parking', 'office', 'visitors', 'nominas', 'vacaciones', 'tablon')),
  enabled    boolean not null default true,
  primary key (entity_id, module)
);

comment on table public.entity_modules is
  'Módulos habilitados por sede. Si una sede no tiene fila para un módulo, se asume enabled=true (opt-out model).';

alter table public.entity_modules enable row level security;

create policy "entity_modules: authenticated read"
  on public.entity_modules for select to authenticated using (true);

create policy "entity_modules: admin write"
  on public.entity_modules for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ─── Config overrides por entidad ────────────────────────────────────────────
-- Misma key-space que system_config pero scoped a una entidad.
-- Lookup: entity_config primero → system_config como fallback.

create table public.entity_config (
  entity_id  uuid not null references public.entities(id) on delete cascade,
  key        text not null,
  value      jsonb not null default 'null'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  primary key (entity_id, key)
);

alter table public.entity_config enable row level security;

create policy "entity_config: authenticated read"
  on public.entity_config for select to authenticated using (true);

create policy "entity_config: admin write"
  on public.entity_config for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ─── Sedes de ejemplo (descomentar para seed) ─────────────────────────────────
-- insert into public.entities (name, short_code) values
--   ('GRUPOSIETE Madrid Centro', 'MAD-C'),
--   ('GRUPOSIETE Madrid Norte', 'MAD-N'),
--   ('GRUPOSIETE Sevilla', 'SEV'),
--   ('GRUPOSIETE Barcelona', 'BCN'),
--   ('GRUPOSIETE Valencia', 'VAL'),
--   ('GRUPOSIETE Bilbao', 'BIL');
