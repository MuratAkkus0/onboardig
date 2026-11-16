CREATE TYPE "public"."feedback_status" AS ENUM('open', 'in_progress', 'done');--> statement-breakpoint
CREATE TYPE "public"."feedback_type" AS ENUM('app_bug', 'content_issue', 'other');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'feedback_resolved';--> statement-breakpoint
CREATE TABLE "feedback_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid,
	"type" "feedback_type" NOT NULL,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"path" text,
	"page_id" uuid,
	"status" "feedback_status" DEFAULT 'open' NOT NULL,
	"response" text,
	"handled_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "feedback_reports" ADD CONSTRAINT "feedback_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_reports" ADD CONSTRAINT "feedback_reports_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_reports" ADD CONSTRAINT "feedback_reports_handled_by_users_id_fk" FOREIGN KEY ("handled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_reports_status_created_idx" ON "feedback_reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "feedback_reports_page_id_idx" ON "feedback_reports" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "feedback_reports_reporter_id_idx" ON "feedback_reports" USING btree ("reporter_id");