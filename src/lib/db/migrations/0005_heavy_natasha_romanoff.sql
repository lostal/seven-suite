DROP INDEX "idx_reservations_user_date";--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "resource_type" "resource_type";--> statement-breakpoint
UPDATE "reservations" AS reservation
SET "resource_type" = spot."resource_type"
FROM "spots" AS spot
WHERE spot."id" = reservation."spot_id";--> statement-breakpoint
ALTER TABLE "reservations"
  ALTER COLUMN "resource_type" SET DEFAULT 'parking',
  ALTER COLUMN "resource_type" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_reservations_user_date" ON "reservations" USING btree ("user_id","date","resource_type") WHERE status = 'confirmed' AND start_time IS NULL;
