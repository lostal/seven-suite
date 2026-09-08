-- This migration is intentionally idempotent. Earlier generated output
-- duplicated part of 0001 and failed on clean installations.
ALTER TABLE "entities"
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_leave_requests_reviewer_id"
  ON "leave_requests" USING btree ("reviewer_id");
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "idx_reservations_spot_date_slot"
  ON "reservations" USING btree ("spot_id", "date", "start_time", "end_time")
  WHERE status = 'confirmed' AND start_time IS NOT NULL;
--> statement-breakpoint

ALTER TABLE "leave_requests" DROP CONSTRAINT IF EXISTS "leave_requests_manager_id_profiles_id_fk";
--> statement-breakpoint
ALTER TABLE "leave_requests" DROP CONSTRAINT IF EXISTS "leave_requests_hr_id_profiles_id_fk";
--> statement-breakpoint
ALTER TABLE "leave_requests" DROP COLUMN IF EXISTS "manager_id";
--> statement-breakpoint
ALTER TABLE "leave_requests" DROP COLUMN IF EXISTS "manager_action_at";
--> statement-breakpoint
ALTER TABLE "leave_requests" DROP COLUMN IF EXISTS "manager_notes";
--> statement-breakpoint
ALTER TABLE "leave_requests" DROP COLUMN IF EXISTS "hr_id";
--> statement-breakpoint
ALTER TABLE "leave_requests" DROP COLUMN IF EXISTS "hr_action_at";
--> statement-breakpoint
ALTER TABLE "leave_requests" DROP COLUMN IF EXISTS "hr_notes";
