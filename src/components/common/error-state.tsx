"use client";

import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  description?: string;
  /** Renders a retry button (error boundaries pass Next's `reset`). */
  onRetry?: () => void;
  className?: string;
}

/** Shown when loading failed; used by the error boundaries and by pages for failed fetches. */
export function ErrorState({ title, description, onRetry, className }: ErrorStateProps) {
  const t = useTranslations("common");
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-destructive/40 p-8 text-center",
        className,
      )}
    >
      <TriangleAlert className="size-8 text-destructive" aria-hidden="true" />
      <p className="font-medium">{title ?? t("states.errorTitle")}</p>
      <p className="max-w-prose text-sm text-muted-foreground">
        {description ?? t("states.errorDescription")}
      </p>
      {onRetry ? (
        <Button variant="outline" onClick={onRetry}>
          {t("actions.retry")}
        </Button>
      ) : null}
    </div>
  );
}
