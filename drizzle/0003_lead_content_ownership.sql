ALTER TABLE "modules" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "templates" ADD COLUMN "lead_managed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "modules" ADD CONSTRAINT "modules_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "modules_department_id_idx" ON "modules" USING btree ("department_id");