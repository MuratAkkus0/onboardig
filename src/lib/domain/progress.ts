const FULL_PERCENT = 100;

export interface Progress {
  completed: number;
  total: number;
  /** 0 when the plan has no active step, otherwise the rounded share of completed steps. */
  percent: number;
}

/**
 * Progress = completions on active steps / active steps (blueprint 4.6). Callers pass counts that
 * already exclude draft and archived pages.
 */
export function computeProgress(completed: number, total: number): Progress {
  return {
    completed,
    total,
    percent: total === 0 ? 0 : Math.round((FULL_PERCENT * completed) / total),
  };
}
