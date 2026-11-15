import { z } from "zod";
import { ONBOARDING_STATUSES } from "@/config/app";
import { idSchema } from "./common";

export const adminOverviewSchema = z.object({
  departmentId: idSchema.optional(),
  teamId: idSchema.optional(),
  status: z.enum(ONBOARDING_STATUSES).optional(),
});

export type AdminOverviewInput = z.input<typeof adminOverviewSchema>;
