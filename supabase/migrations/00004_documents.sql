-- Migration 00004: Infraestructura de documentos (nóminas + corporativos)
--
-- Crea la tabla `documents` con categorías y niveles de acceso.
-- Convención de paths en Storage "documents":
--   payslips/{entity_id}/{user_id}/{year}/{month}.pdf
--   corporate/{entity_id}/{doc_id}.pdf
--
-- Prerequisitos: 00002, 00003
-- Después: pnpm db:types

-- ─── Enums ────────────────────────────────────────────────────────────────────

create type public.document_category as enum ('payslip', 'corporate', 'contract', 'other');
create type public.document_access   as enum ('own', 'entity', 'global');

-- ─── Tabla documents ──────────────────────────────────────────────────────────

create table public.documents (
  id              uuid primary key default uuid_generate_v4(),
  category        public.document_category not null,
  access_level    public.document_access   not null default 'own',
  owner_id        uuid references public.profiles(id) on delete cascade,
  entity_id       uuid references public.entities(id) on delete cascade,
  title           text not null,
  storage_path    text not null,           -- path en bucket "documents" de Supabase Storage
  file_size_bytes bigint,
  mime_type       text not null default 'application/pdf',
  period_year     smallint,                -- para nóminas: 2025
  period_month    smallint                 -- para nóminas: 1-12
    check (period_month between 1 and 12),
  uploaded_by     uuid references public.profiles(id),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.documents is
  'Documentos del sistema: nóminas (category=payslip), corporativos, contratos. '
  'El fichero físico vive en el bucket "documents" de Supabase Storage.';

create index idx_documents_owner_id    on public.documents(owner_id);
create index idx_documents_entity_id   on public.documents(entity_id);
create index idx_documents_category    on public.documents(category);
create index idx_documents_period      on public.documents(period_year, period_month)
  where category = 'payslip';

-- ─── Trigger updated_at ───────────────────────────────────────────────────────

create trigger trg_documents_updated_at
  before update on public.documents
  for each row execute function public.handle_updated_at();

-- ─── RLS documents ────────────────────────────────────────────────────────────

alter table public.documents enable row level security;

-- Empleados: ven sus propios documentos (own) + entity-scoped de su entidad + global
create policy "documents: employee read own and entity"
  on public.documents for select
  to authenticated
  using (
    (access_level = 'own' and owner_id = auth.uid())
    or (access_level = 'entity' and entity_id = (
      select entity_id from public.profiles where id = auth.uid()
    ))
    or (access_level = 'global')
  );

-- HR y admin: ven todo
create policy "documents: hr admin read all"
  on public.documents for select
  to authenticated
  using (public.is_hr());

-- Solo HR/admin pueden insertar, actualizar, borrar
create policy "documents: hr admin write"
  on public.documents for all
  to authenticated
  using (public.is_hr())
  with check (public.is_hr());
