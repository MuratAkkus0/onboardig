import { CheckCircle2, Circle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { LANDING_CONFIG } from "@/config/app";
import { cn } from "@/lib/utils";
import { motionStyle } from "./motion";

interface StepRowProps {
  title: React.ReactNode;
  /** "animated": open on load, then checks itself off once (CSS only). */
  state: "done" | "open" | "animated";
  doneOn?: Date;
  updated?: boolean;
}

/** One plan step as the app renders it, made of inert spans (nothing here is focusable). */
export function StepRow({ title, state, doneOn, updated = false }: StepRowProps) {
  const t = useTranslations("plan");
  const { checkDelayMs, checkMs } = LANDING_CONFIG.motion;
  const timing = motionStyle(checkDelayMs, checkMs);

  const icon = {
    open: <Circle className="size-5 text-muted-foreground" />,
    done: <CheckCircle2 className="size-5 text-success" />,
  };
  const meta = {
    open: <span>{t("step.open")}</span>,
    done: <span>{doneOn ? t("step.doneOn", { date: doneOn }) : null}</span>,
  };
  const action = {
    open: (
      <span className={buttonVariants({ variant: "outline", size: "xs" })}>
        {t("step.markDone")}
      </span>
    ),
    done: (
      <span className={buttonVariants({ variant: "ghost", size: "xs" })}>{t("step.undo")}</span>
    ),
  };

  /** Static rows show one version; the animated row stacks both in one grid cell and swaps them. */
  function slot(versions: { open: React.ReactNode; done: React.ReactNode }, doneAnimation: string) {
    if (state !== "animated") return versions[state];
    return (
      <>
        <span className="landing-anim-fade-out opacity-0 [grid-area:1/1]" style={timing}>
          {versions.open}
        </span>
        <span className={cn("[grid-area:1/1]", doneAnimation)} style={timing}>
          {versions.done}
        </span>
      </>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
      <span className="grid size-5 shrink-0 self-start">{slot(icon, "landing-anim-check")}</span>
      <span className="min-w-0 flex-[1_1_12rem]">
        <span className="block font-medium break-words">{title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="grid">{slot(meta, "landing-anim-fade-in")}</span>
          {updated ? <Badge variant="secondary">{t("updatedSinceCompletion")}</Badge> : null}
        </span>
      </span>
      <span className="ml-auto grid justify-items-end">{slot(action, "landing-anim-fade-in")}</span>
    </li>
  );
}
