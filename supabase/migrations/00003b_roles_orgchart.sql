-- Migration 00003b: Org chart + funciones RLS
--
-- Ejecutar DESPUÉS de 00003a_roles_enum.sql (necesita que los
-- nuevos valores del enum estén ya commitados).
--
-- Añade columnas de org chart a profiles: manager_id, job_title, phone, location.
-- Añade funciones RLS helper: is_hr(), is_manager_or_above(), reports_to_current_user().
--
-- Prerequisito: 00003a_roles_enum.sql aplicado y commitado
-- Después: pnpm db:types

-- ─── Columnas de org chart en profiles ────────────────────────────────────────

alter table public.profiles
  add column if not exists manager_id uuid references public.profiles(id) on delete set null,
  add column if not exists job_title  text,
  add column if not exists phone      text,
  add column if not exists location   text;

comment on column public.profiles.manager_id is
  'Manager directo del empleado. Snapshot al crear solicitudes de vacaciones.';
comment on column public.profiles.job_title is
  'Cargo o puesto del empleado. Mostrado en directorio.';
comment on column public.profiles.phone is
  'Teléfono de contacto. Mostrado en directorio.';
comment on column public.profiles.location is
  'Oficina/sede habitual del empleado. Mostrado en directorio.';

-- ─── Funciones RLS helper ─────────────────────────────────────────────────────

create or replace function public.is_hr()
  returns boolean
  language sql security definer stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('hr', 'admin')
  );
$$;

create or replace function public.is_manager_or_above()
  returns boolean
  language sql security definer stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('manager', 'hr', 'admin')
  );
$$;

create or replace function public.reports_to_current_user(p_user_id uuid)
  returns boolean
  language sql security definer stable
as $$
  select exists (
    select 1 from public.profiles
    where id = p_user_id
      and manager_id = auth.uid()
  );
$$;
