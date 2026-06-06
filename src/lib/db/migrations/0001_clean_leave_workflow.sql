-- Migration: Simplified leave approval workflow
-- Removes two-level approval (manager_approved → hr_approved) in favor of single-step (pending → approved).
-- Merges manager/HR reviewer columns into unified reviewer columns.

-- 1. Add new reviewer columns
ALTER TABLE "leave_requests" ADD COLUMN "reviewer_id" uuid REFERENCES "profiles"("id");
ALTER TABLE "leave_requests" ADD COLUMN "reviewed_at" timestamp with time zone;
ALTER TABLE "leave_requests" ADD COLUMN "reviewer_notes" text;

-- 2. Migrate data from old columns to new unified columns
-- For manager_approved requests: use manager data
UPDATE "leave_requests" SET
  "reviewer_id" = "manager_id",
  "reviewed_at" = "manager_action_at",
  "reviewer_notes" = "manager_notes"
WHERE "status" = 'manager_approved' AND "manager_id" IS NOT NULL;

-- For hr_approved/rejected by HR: use HR data
UPDATE "leave_requests" SET
  "reviewer_id" = "hr_id",
  "reviewed_at" = "hr_action_at",
  "reviewer_notes" = "hr_notes"
WHERE ("status" = 'hr_approved' OR ("status" = 'rejected' AND "hr_id" IS NOT NULL))
  AND "reviewer_id" IS NULL;

-- For rejected by manager only (no HR data): use manager data
UPDATE "leave_requests" SET
  "reviewer_id" = "manager_id",
  "reviewed_at" = "manager_action_at",
  "reviewer_notes" = "manager_notes"
WHERE "reviewer_id" IS NULL AND "manager_id" IS NOT NULL;

-- 3. Drop old columns
ALTER TABLE "leave_requests" DROP COLUMN "manager_id";
ALTER TABLE "leave_requests" DROP COLUMN "manager_action_at";
ALTER TABLE "leave_requests" DROP COLUMN "manager_notes";
ALTER TABLE "leave_requests" DROP COLUMN "hr_id";
ALTER TABLE "leave_requests" DROP COLUMN "hr_action_at";
ALTER TABLE "leave_requests" DROP COLUMN "hr_notes";

-- 4. Replace enum: create new type, alter column, drop old type, rename
CREATE TYPE "leave_status_new" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

ALTER TABLE "leave_requests" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "leave_requests" ALTER COLUMN "status" TYPE "leave_status_new" USING (
  CASE
    WHEN "status"::text = 'manager_approved' THEN 'approved'::text::"leave_status_new"
    WHEN "status"::text = 'hr_approved' THEN 'approved'::text::"leave_status_new"
    ELSE "status"::text::"leave_status_new"
  END
);
ALTER TABLE "leave_requests" ALTER COLUMN "status" SET DEFAULT 'pending';

DROP TYPE "leave_status";
ALTER TYPE "leave_status_new" RENAME TO "leave_status";

-- 5. Add index on reviewer
DROP INDEX IF EXISTS "idx_leave_requests_manager_id";
CREATE INDEX "idx_leave_requests_reviewer_id" ON "leave_requests"("reviewer_id");
