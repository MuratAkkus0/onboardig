import { cn } from "@/lib/utils";

interface MockWindowProps {
  /** Faux address shown in the title bar. */
  path: string;
  className?: string;
  bodyClassName?: string;
  /** "solid" for a window that sits in front of another one, so nothing shows through it. */
  surface?: "glass" | "solid";
  /** "end" keeps the path visible when the left part of the window is covered. */
  pathAlign?: "center" | "end";
  children: React.ReactNode;
}

/** App-window shell for the illustrative mockups (decorative; callers set aria-hidden). */
export function MockWindow({
  path,
  className,
  bodyClassName,
  surface = "glass",
  pathAlign = "center",
  children,
}: MockWindowProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border shadow-float",
        surface === "solid" ? "bg-card text-card-foreground" : "surface-glass",
        className,
      )}
    >
      <div className="flex h-9 items-center gap-1.5 border-b bg-window-chrome px-3">
        <span className="size-2 rounded-full bg-border" />
        <span className="size-2 rounded-full bg-border" />
        <span className="size-2 rounded-full bg-border" />
        <span
          className={cn(
            "truncate px-2 font-landing-mono text-xs text-muted-foreground",
            pathAlign === "end" ? "ml-auto" : "mx-auto",
          )}
        >
          {path}
        </span>
        {pathAlign === "center" ? <span className="w-8 shrink-0" /> : null}
      </div>
      <div className={cn("p-4 text-[0.8125rem] sm:p-5", bodyClassName)}>{children}</div>
    </div>
  );
}
