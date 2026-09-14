CREATE EXTENSION IF NOT EXISTS pgcrypto;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
CREATE TYPE "public"."cession_rule_type" AS ENUM('out_of_office', 'day_of_week');--> statement-breakpoint
CREATE TYPE "public"."cession_status" AS ENUM('available', 'reserved', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."document_access" AS ENUM('own', 'entity', 'global');--> statement-breakpoint
CREATE TYPE "public"."document_category" AS ENUM('payslip', 'corporate', 'contract', 'other');--> statement-breakpoint
CREATE TYPE "public"."leave_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."leave_type" AS ENUM('vacation', 'personal', 'sick', 'other');--> statement-breakpoint
CREATE TYPE "public"."reservation_status" AS ENUM('confirmed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."resource_type" AS ENUM('parking', 'office');--> statement-breakpoint
CREATE TYPE "public"."spot_type" AS ENUM('standard', 'visitor');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('employee', 'manager', 'hr', 'admin');--> statement-breakpoint
CREATE TABLE "accounts" (
	"userId" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"notified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcement_reads" (
	"announcement_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "announcement_reads_announcement_id_user_id_pk" PRIMARY KEY("announcement_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"entity_id" uuid,
	"published_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_id" uuid,
	"actor_email" text NOT NULL,
	"event_type" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cession_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"resource_type" "resource_type" DEFAULT 'parking' NOT NULL,
	"rule_type" "cession_rule_type" NOT NULL,
	"day_of_week" smallint,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"spot_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"status" "cession_status" DEFAULT 'available' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" "document_category" NOT NULL,
	"access_level" "document_access" DEFAULT 'own' NOT NULL,
	"owner_id" uuid,
	"entity_id" uuid,
	"title" text NOT NULL,
	"storage_path" text NOT NULL,
	"file_size_bytes" integer,
	"mime_type" text DEFAULT 'application/pdf' NOT NULL,
	"period_year" smallint,
	"period_month" smallint,
	"uploaded_by" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"short_code" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"autonomous_community" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entities_name_unique" UNIQUE("name"),
	CONSTRAINT "entities_short_code_unique" UNIQUE("short_code")
);
--> statement-breakpoint
CREATE TABLE "entity_config" (
	"entity_id" uuid NOT NULL,
	"key" text NOT NULL,
	"value" jsonb DEFAULT 'null'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "entity_config_entity_id_key_pk" PRIMARY KEY("entity_id","key")
);
--> statement-breakpoint
CREATE TABLE "entity_holiday_calendars" (
	"entity_id" uuid NOT NULL,
	"calendar_id" uuid NOT NULL,
	CONSTRAINT "entity_holiday_calendars_entity_id_calendar_id_pk" PRIMARY KEY("entity_id","calendar_id")
);
--> statement-breakpoint
CREATE TABLE "entity_modules" (
	"entity_id" uuid NOT NULL,
	"module" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	CONSTRAINT "entity_modules_entity_id_module_pk" PRIMARY KEY("entity_id","module")
);
--> statement-breakpoint
CREATE TABLE "holiday_calendars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"country" text DEFAULT 'ES' NOT NULL,
	"region" text,
	"year" smallint NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holidays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"calendar_id" uuid NOT NULL,
	"date" date NOT NULL,
	"name" text NOT NULL,
	"is_optional" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"leave_type" "leave_type" DEFAULT 'vacation' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" "leave_status" DEFAULT 'pending' NOT NULL,
	"reason" text,
	"reviewer_id" uuid,
	"reviewed_at" timestamp with time zone,
	"reviewer_notes" text,
	"working_days" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_subscriptions" (
	"user_id" uuid NOT NULL,
	"module" text NOT NULL,
	"event_type" text NOT NULL,
	"channel" text DEFAULT 'email' NOT NULL,
	CONSTRAINT "notification_subscriptions_user_id_module_event_type_pk" PRIMARY KEY("user_id","module","event_type")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"full_name" text DEFAULT '' NOT NULL,
	"avatar_url" text,
	"role" "user_role" DEFAULT 'employee' NOT NULL,
	"entity_id" uuid,
	"dni" text,
	"manager_id" uuid,
	"job_title" text,
	"phone" text,
	"location" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_dni_unique" UNIQUE("dni")
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"spot_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"resource_type" "resource_type" DEFAULT 'parking' NOT NULL,
	"date" date NOT NULL,
	"status" "reservation_status" DEFAULT 'confirmed' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_maps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"resource_type" "resource_type" NOT NULL,
	"file_data" "bytea" NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size_bytes" integer NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"type" "spot_type" DEFAULT 'standard' NOT NULL,
	"resource_type" "resource_type" DEFAULT 'parking' NOT NULL,
	"assigned_to" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"position_x" real,
	"position_y" real,
	"entity_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "spots_label_unique" UNIQUE("label")
);
--> statement-breakpoint
CREATE TABLE "system_config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "user_microsoft_tokens" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"token_expires_at" timestamp with time zone NOT NULL,
	"scopes" text[] DEFAULT '{}' NOT NULL,
	"teams_tenant_id" text,
	"teams_user_id" text,
	"teams_conversation_id" text,
	"outlook_calendar_id" text,
	"last_calendar_sync_at" timestamp with time zone,
	"last_ooo_check_at" timestamp with time zone,
	"current_ooo_status" boolean DEFAULT false NOT NULL,
	"current_ooo_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"notification_channel" text DEFAULT 'teams' NOT NULL,
	"notify_reservation_confirmed" boolean DEFAULT true NOT NULL,
	"notify_reservation_reminder" boolean DEFAULT true NOT NULL,
	"notify_cession_reserved" boolean DEFAULT true NOT NULL,
	"notify_alert_triggered" boolean DEFAULT true NOT NULL,
	"notify_visitor_confirmed" boolean DEFAULT false NOT NULL,
	"notify_daily_digest" boolean DEFAULT false NOT NULL,
	"daily_digest_time" time DEFAULT '09:00',
	"outlook_create_events" boolean DEFAULT true NOT NULL,
	"outlook_calendar_name" text DEFAULT 'Parking',
	"outlook_sync_enabled" boolean DEFAULT true NOT NULL,
	"outlook_sync_interval" integer DEFAULT 15,
	"auto_cede_on_ooo" boolean DEFAULT true NOT NULL,
	"auto_cede_notify" boolean DEFAULT true NOT NULL,
	"auto_cede_days" integer[] DEFAULT '{}',
	"default_view" text DEFAULT 'map' NOT NULL,
	"favorite_spot_ids" uuid[] DEFAULT '{}',
	"usual_arrival_time" time DEFAULT '09:00',
	"theme" text DEFAULT 'system' NOT NULL,
	"locale" text DEFAULT 'es' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"emailVerified" timestamp,
	"image" text,
	"password" text,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "visitor_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"spot_id" uuid NOT NULL,
	"reserved_by" uuid NOT NULL,
	"date" date NOT NULL,
	"visitor_name" text NOT NULL,
	"visitor_company" text NOT NULL,
	"visitor_email" text NOT NULL,
	"status" "reservation_status" DEFAULT 'confirmed' NOT NULL,
	"notification_sent" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_announcement_id_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cession_rules" ADD CONSTRAINT "cession_rules_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cessions" ADD CONSTRAINT "cessions_spot_id_spots_id_fk" FOREIGN KEY ("spot_id") REFERENCES "public"."spots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cessions" ADD CONSTRAINT "cessions_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_profiles_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_config" ADD CONSTRAINT "entity_config_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_config" ADD CONSTRAINT "entity_config_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_holiday_calendars" ADD CONSTRAINT "entity_holiday_calendars_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_holiday_calendars" ADD CONSTRAINT "entity_holiday_calendars_calendar_id_holiday_calendars_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."holiday_calendars"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_modules" ADD CONSTRAINT "entity_modules_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_calendar_id_holiday_calendars_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."holiday_calendars"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_profiles_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_reviewer_id_profiles_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_subscriptions" ADD CONSTRAINT "notification_subscriptions_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_spot_id_spots_id_fk" FOREIGN KEY ("spot_id") REFERENCES "public"."spots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_maps" ADD CONSTRAINT "resource_maps_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_maps" ADD CONSTRAINT "resource_maps_uploaded_by_profiles_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spots" ADD CONSTRAINT "spots_assigned_to_profiles_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spots" ADD CONSTRAINT "spots_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_config" ADD CONSTRAINT "system_config_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_microsoft_tokens" ADD CONSTRAINT "user_microsoft_tokens_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitor_reservations" ADD CONSTRAINT "visitor_reservations_spot_id_spots_id_fk" FOREIGN KEY ("spot_id") REFERENCES "public"."spots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitor_reservations" ADD CONSTRAINT "visitor_reservations_reserved_by_profiles_id_fk" FOREIGN KEY ("reserved_by") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_alerts_user_date" ON "alerts" USING btree ("user_id","date") WHERE notified = false;--> statement-breakpoint
CREATE INDEX "idx_alerts_date" ON "alerts" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_announcements_entity_id" ON "announcements" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "idx_announcements_published_at" ON "announcements" USING btree ("published_at") WHERE published_at IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_audit_events_actor_id" ON "audit_events" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "idx_audit_events_event_type" ON "audit_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_audit_events_entity_id" ON "audit_events" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "idx_audit_events_created_at" ON "audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_cession_rules_user_resource" ON "cession_rules" USING btree ("user_id","resource_type");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_cessions_spot_date" ON "cessions" USING btree ("spot_id","date") WHERE status != 'cancelled';--> statement-breakpoint
CREATE INDEX "idx_cessions_date" ON "cessions" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_cessions_user_id" ON "cessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_documents_owner_id" ON "documents" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_documents_entity_id" ON "documents" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "idx_documents_category" ON "documents" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_documents_period" ON "documents" USING btree ("period_year","period_month") WHERE category = 'payslip';--> statement-breakpoint
CREATE UNIQUE INDEX "idx_holidays_calendar_date" ON "holidays" USING btree ("calendar_id","date");--> statement-breakpoint
CREATE INDEX "idx_holidays_date" ON "holidays" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_leave_requests_employee_id" ON "leave_requests" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_leave_requests_reviewer_id" ON "leave_requests" USING btree ("reviewer_id");--> statement-breakpoint
CREATE INDEX "idx_leave_requests_status" ON "leave_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_profiles_entity_id" ON "profiles" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "idx_profiles_dni" ON "profiles" USING btree ("dni");--> statement-breakpoint
CREATE INDEX "idx_reservations_date" ON "reservations" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_reservations_spot_date" ON "reservations" USING btree ("spot_id","date") WHERE status = 'confirmed';--> statement-breakpoint
CREATE UNIQUE INDEX "idx_reservations_user_date" ON "reservations" USING btree ("user_id","date","resource_type") WHERE status = 'confirmed';--> statement-breakpoint
CREATE UNIQUE INDEX "idx_resource_maps_entity_resource" ON "resource_maps" USING btree ("entity_id","resource_type");--> statement-breakpoint
CREATE INDEX "idx_resource_maps_entity_id" ON "resource_maps" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "idx_spots_type" ON "spots" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_spots_resource_type" ON "spots" USING btree ("resource_type");--> statement-breakpoint
CREATE INDEX "idx_spots_assigned_to" ON "spots" USING btree ("assigned_to");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_spots_assigned_resource" ON "spots" USING btree ("assigned_to","resource_type") WHERE assigned_to IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_visitor_reservations_spot_date" ON "visitor_reservations" USING btree ("spot_id","date") WHERE status = 'confirmed';--> statement-breakpoint
CREATE INDEX "idx_visitor_reservations_date" ON "visitor_reservations" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_visitor_reservations_reserved_by" ON "visitor_reservations" USING btree ("reserved_by");--> statement-breakpoint

ALTER TABLE "profiles"
  ADD CONSTRAINT "profiles_manager_id_profiles_id_fk"
  FOREIGN KEY ("manager_id") REFERENCES "public"."profiles"("id")
  ON DELETE SET NULL ON UPDATE no action;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.validate_reservation_resource_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  spot_resource_type resource_type;
BEGIN
  SELECT resource_type
    INTO spot_resource_type
    FROM public.spots
   WHERE id = NEW.spot_id;

  IF spot_resource_type IS NULL OR NEW.resource_type <> spot_resource_type THEN
    RAISE EXCEPTION 'Reservation resource type does not match spot resource type';
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER trg_validate_reservation_resource_type
BEFORE INSERT OR UPDATE OF spot_id, resource_type ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.validate_reservation_resource_type();--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.prevent_spot_resource_type_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.resource_type <> OLD.resource_type
     AND EXISTS (
       SELECT 1 FROM public.reservations WHERE spot_id = OLD.id
     ) THEN
    RAISE EXCEPTION 'Cannot change resource type of a spot with reservations';
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER trg_prevent_spot_resource_type_change
BEFORE UPDATE OF resource_type ON public.spots
FOR EACH ROW EXECUTE FUNCTION public.prevent_spot_resource_type_change();--> statement-breakpoint

ALTER TABLE "leave_requests"
  ADD CONSTRAINT "leave_requests_no_overlap"
  EXCLUDE USING gist (
    "employee_id" WITH =,
    daterange("start_date", "end_date", '[]') WITH &&
  )
  WHERE ("status" IN ('pending', 'approved'));
