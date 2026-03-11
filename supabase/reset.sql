-- ============================================================
-- GRUPOSIETE ERP — Reset Completo
-- ============================================================
-- Borra todo el schema publico y los usuarios de prueba.
--
-- Orden de ejecucion para reimportacion limpia:
--   1. reset.sql          <- este archivo
--   2. 00001_schema.sql
--   3. 00002_entities.sql
--   4. 00003a_roles_enum.sql  (commit)
--   5. 00003b_roles_orgchart.sql
--   6. 00004_documents.sql
--   7. 00005_entity_config.sql
--   8. 00006_leave_requests.sql
--   9. 00007_announcements.sql
--  10. 00008_work_calendars.sql
--  11. 00009_audit_log.sql
--  12. seed.sql
-- ============================================================

-- ─── Triggers sobre auth.users ───────────────────────────────
drop trigger if exists on_auth_user_created             on auth.users;
drop trigger if exists on_auth_user_created_preferences on public.profiles;
drop trigger if exists trg_sync_cession_status          on public.reservations;

-- ─── Funciones ───────────────────────────────────────────────
drop function if exists public.handle_new_user()                          cascade;
drop function if exists public.handle_new_user_preferences()              cascade;
drop function if exists public.handle_updated_at()                        cascade;
drop function if exists public.get_user_role()                            cascade;
drop function if exists public.is_admin()                                 cascade;
drop function if exists public.is_hr()                                    cascade;
drop function if exists public.is_manager_or_above()                      cascade;
drop function if exists public.reports_to_current_user(uuid)              cascade;
drop function if exists public.user_has_assigned_spot(text)               cascade;
drop function if exists public.sync_cession_status()                      cascade;
drop function if exists public.reservation_tsrange(date, time, time)      cascade;
-- Funciones obsoletas (por si se hace reset sobre BD antigua)
drop function if exists public.is_management()                            cascade;
drop function if exists public.management_has_spot()                      cascade;

-- ─── Tablas (orden inverso a las foreign keys) ───────────────

-- Módulos y configuración de entidades
drop table if exists public.entity_holiday_calendars   cascade;
drop table if exists public.entity_config              cascade;
drop table if exists public.entity_modules             cascade;

-- Logs y auditoría
drop table if exists public.audit_events               cascade;

-- Tablón
drop table if exists public.announcement_reads         cascade;
drop table if exists public.announcements              cascade;

-- Vacaciones
drop table if exists public.notification_subscriptions cascade;
drop table if exists public.leave_requests             cascade;

-- Calendarios laborales
drop table if exists public.holidays                   cascade;
drop table if exists public.holiday_calendars          cascade;

-- Documentos / Nóminas
drop table if exists public.documents                  cascade;

-- Usuarios y preferencias
drop table if exists public.user_microsoft_tokens      cascade;
drop table if exists public.user_preferences           cascade;

-- Sistema
drop table if exists public.system_config              cascade;
drop table if exists public.cession_rules              cascade;
drop table if exists public.alerts                     cascade;
drop table if exists public.visitor_reservations       cascade;
drop table if exists public.cessions                   cascade;
drop table if exists public.reservations               cascade;
drop table if exists public.spots                      cascade;

-- Entidades / Empresas
drop table if exists public.profiles                   cascade;
drop table if exists public.entities                   cascade;

-- ─── Tipos enumerados ────────────────────────────────────────
drop type if exists public.document_category  cascade;
drop type if exists public.document_access    cascade;
drop type if exists public.leave_status       cascade;
drop type if exists public.leave_type         cascade;
drop type if exists public.user_role          cascade;
drop type if exists public.spot_type          cascade;
drop type if exists public.resource_type      cascade;
drop type if exists public.reservation_status cascade;
drop type if exists public.cession_status     cascade;
drop type if exists public.cession_rule_type  cascade;

-- ─── Usuarios de prueba ──────────────────────────────────────
delete from auth.users
where email in (
  'admin@gruposiete.com',
  'empleado@gruposiete.com',
  'empleado-fijo@gruposiete.com',
  'empleado-solo-parking@gruposiete.com',
  'empleado-solo-oficina@gruposiete.com'
);
