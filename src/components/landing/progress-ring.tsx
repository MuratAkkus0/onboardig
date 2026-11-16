import { LANDING_CONFIG } from "@/config/app";
import { cssVars, motionStyle } from "./motion";

interface ProgressRingProps {
  from: number;
  to: number;
  labelFrom: string;
  labelTo: string;
  delayMs: number;
  durationMs: number;
  fadeMs: number;
}

/**
 * Progress ring that fills from `from` to `to` (fractions) once, in CSS. The default style is the
 * final value, so reduced motion shows `to` immediately.
 */
export function ProgressRing({
  from,
  to,
  labelFrom,
  labelTo,
  delayMs,
  durationMs,
  fadeMs,
}: ProgressRingProps) {
  const { sizePx, mobileSizePx, strokePx } = LANDING_CONFIG.ring;
  const center = sizePx / 2;
  const radius = (sizePx - strokePx) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <div
      className="grid size-(--ring-size-mobile) shrink-0 place-items-center sm:size-(--ring-size)"
      style={cssVars({ "--ring-size": `${sizePx}px`, "--ring-size-mobile": `${mobileSizePx}px` })}
    >
      <svg viewBox={`0 0 ${sizePx} ${sizePx}`} className="size-full -rotate-90 [grid-area:1/1]">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokePx}
          className="stroke-ring-track"
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokePx}
          strokeLinecap="round"
          strokeDasharray={circumference}
          className="landing-anim-ring stroke-brand"
          style={{
            strokeDashoffset: "var(--ring-to)",
            ...cssVars({
              "--ring-from": `${circumference * (1 - from)}px`,
              "--ring-to": `${circumference * (1 - to)}px`,
            }),
            ...motionStyle(delayMs, durationMs),
          }}
        />
      </svg>
      <span className="grid place-items-center font-landing-mono text-xs font-semibold tabular-nums [grid-area:1/1] sm:text-sm">
        <span
          className="landing-anim-fade-out opacity-0 [grid-area:1/1]"
          style={motionStyle(delayMs, fadeMs)}
        >
          {labelFrom}
        </span>
        <span className="landing-anim-fade-in [grid-area:1/1]" style={motionStyle(delayMs, fadeMs)}>
          {labelTo}
        </span>
      </span>
    </div>
  );
}
