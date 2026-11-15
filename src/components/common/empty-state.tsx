import { Inbox } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

/** Shown when a list has no entries. Texts default to the generic common.states copy. */
export async function EmptyState({ title, description, action, icon, className }: EmptyStateProps) {
  const t = await getTranslations("common.states");
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center",
        className,
      )}
    >
      <div className="text-muted-foreground" aria-hidden="true">
        {icon ?? <Inbox className="size-8" />}
      </div>
      <p className="font-medium">{title ?? t("emptyTitle")}</p>
      <p className="max-w-prose text-sm text-muted-foreground">
        {description ?? t("emptyDescription")}
      </p>
      {action}
    </div>
  );
}
