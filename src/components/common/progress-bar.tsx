import { useTranslations } from "next-intl";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  /** Percent, 0 to 100 (clamped). */
  value: number;
  showValue?: boolean;
  className?: string;
}

const MAX_PERCENT = 100;

export function ProgressBar({ value, showValue = true, className }: ProgressBarProps) {
  const t = useTranslations("common.progress");
  const percent = Math.min(MAX_PERCENT, Math.max(0, Math.round(value)));
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Progress value={percent} aria-label={t("label", { percent })} className="flex-1" />
      {showValue ? (
        <span className="w-10 text-right text-sm text-muted-foreground tabular-nums">
          {percent}%
        </span>
      ) : null}
    </div>
  );
}
