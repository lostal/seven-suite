-- ============================================================
-- GRUPOSIETE ERP — Seed Unificado
-- ============================================================
-- Crea entidades, usuarios de prueba + asigna plazas reales.
--
-- Orden de ejecucion:
--   1. reset.sql
--   2. TODAS las migraciones en orden (00001 .. última)  ← incluye 00011_spots_entity
--   3. seed.sql           <- este archivo
--
-- IMPORTANTE: El seed debe ejecutarse DESPUES de TODAS las migraciones,
-- especialmente 00011_spots_entity.sql que agrega entity_id a spots.
-- Si lo ejecutas antes, el paso 6b (asignacion de sede a plazas) fallara.
--
-- Usuarios de prueba:
--   admin@gruposiete.com               / Admin1234!       → admin
--   empleado-fijo@gruposiete.com       / Empleado1234!    → employee (plaza parking 15 + OF-01..OF-05)
--   empleado@gruposiete.com            / Empleado1234!    → employee (sin plaza fija)
--   empleado-solo-parking@gruposiete.com / Empleado1234!  → employee (plaza parking 16, sin oficina)
--   empleado-solo-oficina@gruposiete.com / Empleado1234!  → employee (OF-08, sin parking)
-- ============================================================

-- ─── 1. Limpiar datos de transaccion previos ─────────────────
truncate table public.audit_events               restart identity cascade;
truncate table public.announcement_reads         cascade;
truncate table public.announcements              cascade;
truncate table public.notification_subscriptions cascade;
truncate table public.leave_requests             cascade;
truncate table public.documents                  cascade;
truncate table public.cession_rules              cascade;
truncate table public.cessions                   cascade;
truncate table public.reservations               cascade;
truncate table public.visitor_reservations       cascade;
truncate table public.alerts                     cascade;

-- ─── 2. Limpiar usuarios de prueba previos ───────────────────
delete from auth.users
where email in (
  'admin@gruposiete.com',
  'empleado@gruposiete.com',
  'empleado-fijo@gruposiete.com',
  'empleado-solo-parking@gruposiete.com',
  'empleado-solo-oficina@gruposiete.com'
);

-- ─── 3. Entidades (sedes) ────────────────────────────────────
-- Placeholder de sedes del Grupo Siete.
-- Se puede ampliar desde Administración → Sedes.

insert into public.entities (name, short_code, is_active)
values
  ('Madrid Centro',    'MAD', true),
  ('Madrid Norte',     'MDN', true),
  ('Barcelona',        'BCN', true),
  ('Valencia',         'VLC', true),
  ('Sevilla',          'SVQ', true),
  ('Bilbao',           'BIO', true),
  ('Zaragoza',         'ZAZ', true)
on conflict (short_code) do nothing;

-- ─── 4. Insertar usuarios en auth.users ──────────────────────

insert into auth.users (
  id, instance_id, email, encrypted_password,
  email_confirmed_at, raw_user_meta_data,
  role, aud, created_at, updated_at,
  confirmation_token, recovery_token,
  email_change_token_new, email_change
)
values
  -- Admin del sistema
  (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'admin@gruposiete.com',
    crypt('Admin1234!', gen_salt('bf')),
    now(),
    '{"full_name": "Administrador Sistema", "user_type": "admin"}'::jsonb,
    'authenticated', 'authenticated',
    now(), now(), '', '', '', ''
  ),
  -- Empleado con plaza de parking fija asignada
  (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'empleado-fijo@gruposiete.com',
    crypt('Empleado1234!', gen_salt('bf')),
    now(),
    '{"full_name": "Empleado Con Plaza"}'::jsonb,
    'authenticated', 'authenticated',
    now(), now(), '', '', '', ''
  ),
  -- Empleado sin plaza fija (reserva en las disponibles del dia)
  (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'empleado@gruposiete.com',
    crypt('Empleado1234!', gen_salt('bf')),
    now(),
    '{"full_name": "Empleado General"}'::jsonb,
    'authenticated', 'authenticated',
    now(), now(), '', '', '', ''
  ),
  -- Empleado con plaza de parking pero sin plaza de oficina
  (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'empleado-solo-parking@gruposiete.com',
    crypt('Empleado1234!', gen_salt('bf')),
    now(),
    '{"full_name": "Empleado Solo Parking"}'::jsonb,
    'authenticated', 'authenticated',
    now(), now(), '', '', '', ''
  ),
  -- Empleado con plaza de oficina pero sin plaza de parking
  (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'empleado-solo-oficina@gruposiete.com',
    crypt('Empleado1234!', gen_salt('bf')),
    now(),
    '{"full_name": "Empleado Solo Oficina"}'::jsonb,
    'authenticated', 'authenticated',
    now(), now(), '', '', '', ''
  );

-- ─── 5. Insertar identidades (necesario para login por email) ─

insert into auth.identities (
  id, provider_id, user_id, identity_data,
  provider, last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(),
  u.id::text,
  u.id,
  jsonb_build_object(
    'sub',       u.id::text,
    'email',     u.email,
    'full_name', u.raw_user_meta_data->>'full_name'
  ),
  'email',
  now(), now(), now()
from auth.users u
where u.email in (
  'admin@gruposiete.com',
  'empleado@gruposiete.com',
  'empleado-fijo@gruposiete.com',
  'empleado-solo-parking@gruposiete.com',
  'empleado-solo-oficina@gruposiete.com'
)
on conflict (provider, provider_id) do nothing;

-- ─── 6. Sincronizar perfiles ──────────────────────────────────
-- El trigger handle_new_user los crea automaticamente,
-- pero garantizamos los roles aqui explicitamente.

insert into public.profiles (id, email, full_name, role)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'full_name', ''),
  case
    when u.raw_user_meta_data->>'user_type' = 'admin' then 'admin'::public.user_role
    else 'employee'::public.user_role
  end
from auth.users u
where u.email in (
  'admin@gruposiete.com',
  'empleado@gruposiete.com',
  'empleado-fijo@gruposiete.com',
  'empleado-solo-parking@gruposiete.com',
  'empleado-solo-oficina@gruposiete.com'
)
on conflict (id) do update
  set role       = excluded.role,
      full_name  = excluded.full_name,
      email      = excluded.email,
      updated_at = now();

-- ─── 6b. Asignar plazas a Madrid Centro (sede por defecto para seed) ──
update public.spots
set entity_id = (select id from public.entities where short_code = 'MAD')
where entity_id is null;

-- ─── 7. Asignar plaza de parking al empleado fijo ────────────
-- Plaza 15 asignada a 'empleado-fijo@gruposiete.com'
-- El admin puede cambiar esto desde Administracion → Usuarios.

update public.spots
set assigned_to = (
  select id from public.profiles where email = 'empleado-fijo@gruposiete.com'
)
where label = '15'
  and resource_type = 'parking';

-- ─── 8. Asignar plaza de parking al empleado-solo-parking ────
-- Plaza 16 asignada a 'empleado-solo-parking@gruposiete.com'

update public.spots
set assigned_to = (
  select id from public.profiles where email = 'empleado-solo-parking@gruposiete.com'
)
where label = '16'
  and resource_type = 'parking';

-- ─── 9. Asignar plaza de oficina al empleado-solo-oficina ────
-- OF-08 asignada a 'empleado-solo-oficina@gruposiete.com'

update public.spots
set assigned_to = (
  select id from public.profiles where email = 'empleado-solo-oficina@gruposiete.com'
)
where label = 'OF-08'
  and resource_type = 'office';

-- ─── Resumen ─────────────────────────────────────────────────
-- Entidades (7 sedes placeholder):
--   MAD — Madrid Centro
--   MDN — Madrid Norte
--   BCN — Barcelona
--   VLC — Valencia
--   SVQ — Sevilla
--   BIO — Bilbao
--   ZAZ — Zaragoza
--
-- Usuarios:
--   admin@gruposiete.com                 Admin1234!    admin
--   empleado-fijo@gruposiete.com         Empleado1234! employee (parking 15)
--   empleado@gruposiete.com              Empleado1234! employee (sin plaza fija)
--   empleado-solo-parking@gruposiete.com Empleado1234! employee (parking 16, sin oficina)
--   empleado-solo-oficina@gruposiete.com Empleado1234! employee (OF-08, sin parking)
--
-- Spots (creados en 00001_schema.sql):
--   Parking standard libres: 13, 14, 17, 18, 19, 49  (15→fijo, 16→solo-parking)
--   Parking visitor:  50
--   Oficina standard: OF-01..OF-09  (OF-08→solo-oficina; OF-06, OF-07 sin dueño)
--   Oficina inactiva: OF-10 (is_active = false)
