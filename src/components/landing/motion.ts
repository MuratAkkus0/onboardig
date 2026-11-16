import type { CSSProperties } from "react";

/**
 * Inline timing for the landing-* animation utilities (globals.css). Only custom properties, never
 * colors; the utilities ignore them under prefers-reduced-motion.
 */
export function motionStyle(delayMs: number, durationMs?: number): CSSProperties {
  return {
    "--landing-delay": `${delayMs}ms`,
    ...(durationMs === undefined ? {} : { "--landing-duration": `${durationMs}ms` }),
  } as CSSProperties;
}

/** Custom properties for an element, typed for React's style prop. */
export function cssVars(vars: Record<`--${string}`, string | number>): CSSProperties {
  return vars as CSSProperties;
}
