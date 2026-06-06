ALTER TABLE "leave_requests" DROP CONSTRAINT "leave_requests_manager_id_profiles_id_fk";
--> statement-breakpoint
ALTER TABLE "leave_requests" DROP CONSTRAINT "leave_requests_hr_id_profiles_id_fk";
--> statement-breakpoint
ALTER TABLE "leave_requests" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "leave_requests" ALTER COLUMN "status" SET DEFAULT 'pending'::text;--> statement-breakpoint
DROP TYPE "public"."leave_status";--> statement-breakpoint
CREATE TYPE "public"."leave_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
ALTER TABLE "leave_requests" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."leave_status";--> statement-breakpoint
ALTER TABLE "leave_requests" ALTER COLUMN "status" SET DATA TYPE "public"."leave_status" USING "status"::"public"."leave_status";--> statement-breakpoint
DROP INDEX "idx_leave_requests_manager_id";--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN "reviewer_id" uuid;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN "reviewer_notes" text;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_reviewer_id_profiles_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_leave_requests_reviewer_id" ON "leave_requests" USING btree ("reviewer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_reservations_spot_date_slot" ON "reservations" USING btree ("spot_id","date","start_time","end_time") WHERE status = 'confirmed' AND start_time IS NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_requests" DROP COLUMN "manager_id";--> statement-breakpoint
ALTER TABLE "leave_requests" DROP COLUMN "manager_action_at";--> statement-breakpoint
ALTER TABLE "leave_requests" DROP COLUMN "manager_notes";--> statement-breakpoint
ALTER TABLE "leave_requests" DROP COLUMN "hr_id";--> statement-breakpoint
ALTER TABLE "leave_requests" DROP COLUMN "hr_action_at";--> statement-breakpoint
ALTER TABLE "leave_requests" DROP COLUMN "hr_notes";