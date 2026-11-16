ALTER TABLE "job_roles" DROP CONSTRAINT "job_roles_name_uq";--> statement-breakpoint
ALTER TABLE "job_roles" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "job_roles" ADD CONSTRAINT "job_roles_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_roles_department_id_idx" ON "job_roles" USING btree ("department_id");--> statement-breakpoint
ALTER TABLE "job_roles" ADD CONSTRAINT "job_roles_department_name_uq" UNIQUE NULLS NOT DISTINCT("department_id","name");