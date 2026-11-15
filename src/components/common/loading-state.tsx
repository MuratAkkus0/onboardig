import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  /** Number of skeleton rows. */
  rows?: number;
  className?: string;
}

const DEFAULT_ROWS = 3;

/** Skeleton placeholder used by loading.tsx and Suspense fallbacks. */
export async function LoadingState({ rows = DEFAULT_ROWS, className }: LoadingStateProps) {
  const t = await getTranslations("common.states");
  return (
    <div role="status" aria-busy="true" className={cn("space-y-4", className)}>
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="h-8 w-1/3" />
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-16 w-full" />
      ))}
    </div>
  );
}
