-- Migration 00003: Roles ampliados + org chart
--
-- Añade roles `manager` y `hr` al enum user_role.
-- Añade columnas de org chart a profiles: manager_id, job_title, phone, location.
-- Añade funciones RLS helper: is_hr(), is_manager_or_above(), reports_to_current_user().
--
-- Prerequisito: 00002_entities.sql
-- Después: pnpm db:types

-- ─── Enum user_role — nuevos valores ──────────────────────────────────────────

alter type public.user_role add value 'manager' after 'employee';
alter type public.user_role add value 'hr' after 'manager';

-- ─── Columnas de org chart en profiles ────────────────────────────────────────

alter table public.profiles
  add column manager_id uuid references public.profiles(id) on delete set null,
  add column job_title  text,
  add column phone      text,
  add column location   text;

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
