-- Repair custom PostgreSQL objects that were previously kept outside the
-- Drizzle journal. This migration is safe for fresh and existing databases.
CREATE EXTENSION IF NOT EXISTS "btree_gist";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
--> statement-breakpoint

-- Auth.js does not need OAuth bearer credentials after sign-in. The
-- application-owned token table is the single source used for Graph calls.
UPDATE accounts
SET access_token = NULL,
    refresh_token = NULL
WHERE provider = 'microsoft-entra-id';
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.sync_cession_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'confirmed' THEN
    UPDATE cessions
    SET status = 'reserved'
    WHERE spot_id = NEW.spot_id
      AND date = NEW.date
      AND status = 'available';
  ELSIF NEW.status = 'cancelled' THEN
    UPDATE cessions
    SET status = 'available'
    WHERE spot_id = NEW.spot_id
      AND date = NEW.date
      AND status = 'reserved';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'profiles', 'spots', 'reservations', 'cessions',
    'visitor_reservations', 'cession_rules', 'system_config',
    'user_preferences', 'entities', 'documents', 'leave_requests'
  ] LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgrelid = format('public.%I', table_name)::regclass
          AND tgname = 'handle_updated_at'
      ) THEN
      EXECUTE format(
        'CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at()',
        table_name
      );
    END IF;
  END LOOP;
END
$$;
--> statement-breakpoint

-- Legacy slot reservations are converted to full-day reservations because
-- the current booking model no longer supports time ranges. Keep the history
-- of slots that collide with an existing booking, but no longer mark them as
-- confirmed so the current full-day uniqueness rules remain valid.
WITH legacy AS (
  SELECT id, user_id, spot_id, date, created_at
  FROM reservations
  WHERE status = 'confirmed'
    AND start_time IS NOT NULL
), conflicts AS (
  SELECT legacy.id
  FROM legacy
  WHERE EXISTS (
    SELECT 1
    FROM reservations existing
    WHERE existing.status = 'confirmed'
      AND existing.start_time IS NULL
      AND existing.user_id = legacy.user_id
      AND existing.date = legacy.date
  )
  OR EXISTS (
    SELECT 1
    FROM reservations existing
    WHERE existing.status = 'confirmed'
      AND existing.start_time IS NULL
      AND existing.spot_id = legacy.spot_id
      AND existing.date = legacy.date
  )
  OR EXISTS (
    SELECT 1
    FROM legacy previous
    WHERE (
      (previous.user_id = legacy.user_id AND previous.date = legacy.date)
      OR (previous.spot_id = legacy.spot_id AND previous.date = legacy.date)
    )
      AND (previous.created_at, previous.id) < (legacy.created_at, legacy.id)
  )
)
UPDATE reservations
SET status = 'cancelled'
WHERE id IN (SELECT id FROM conflicts);
--> statement-breakpoint

UPDATE reservations
SET start_time = NULL,
    end_time = NULL
WHERE start_time IS NOT NULL OR end_time IS NOT NULL;
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM reservations
    WHERE (start_time IS NULL) <> (end_time IS NULL)
       OR (start_time IS NOT NULL AND end_time <= start_time)
  ) THEN
    RAISE EXCEPTION 'Existing reservations contain invalid time ranges';
  END IF;

  IF EXISTS (
    SELECT 1 FROM leave_requests
    WHERE end_date < start_date
  ) THEN
    RAISE EXCEPTION 'Existing leave requests contain invalid date ranges';
  END IF;
END
$$;
--> statement-breakpoint

ALTER TABLE reservations
  ADD CONSTRAINT reservations_valid_time_range
  CHECK (
    (start_time IS NULL AND end_time IS NULL)
    OR (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
);
--> statement-breakpoint

ALTER TABLE reservations
  ADD CONSTRAINT reservations_full_day_only
  CHECK (start_time IS NULL AND end_time IS NULL);
--> statement-breakpoint

ALTER TABLE leave_requests
  ADD CONSTRAINT leave_requests_valid_date_range
  CHECK (end_date >= start_date);
--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_sync_cession_status ON public.reservations;
CREATE TRIGGER trg_sync_cession_status
  AFTER INSERT OR UPDATE OF status ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.sync_cession_status();
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_spot_date
  ON reservations (spot_id, date)
  WHERE status = 'confirmed' AND start_time IS NULL AND end_time IS NULL;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_user_date
  ON reservations (user_id, date)
  WHERE status = 'confirmed' AND start_time IS NULL AND end_time IS NULL;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS idx_visitor_reservations_spot_date
  ON visitor_reservations (spot_id, date)
  WHERE status = 'confirmed';
