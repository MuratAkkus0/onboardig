import { ONBOARDING_STATUSES } from "@/config/app";
import type { OverviewRow } from "@/server/services/dashboards";

export interface OverviewSummary {
  total: number;
  byStatus: Record<(typeof ONBOARDING_STATUSES)[number], number>;
  /** Mean of the per-employee percentages, rounded; 0 for an empty list. */
  averagePercent: number;
}

export function summarizeOverview(
  rows: readonly Pick<OverviewRow, "status" | "percent">[],
): OverviewSummary {
  const byStatus = { active: 0, completed: 0, archived: 0 };
  let sum = 0;
  for (const row of rows) {
    byStatus[row.status] += 1;
    sum += row.percent;
  }
  return {
    total: rows.length,
    byStatus,
    averagePercent: rows.length === 0 ? 0 : Math.round(sum / rows.length),
  };
}
