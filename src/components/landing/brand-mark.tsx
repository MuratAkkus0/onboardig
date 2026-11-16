import { AppLogo } from "@/components/layout/app-logo";
import { APP_CONFIG } from "@/config/app";
import { cn } from "@/lib/utils";

/**
 * Logo + app name. The logo file is a fixed dark tile, so dark mode adds a hairline ring to keep it
 * visible on dark backgrounds. The header hides the name below 400px to make room for its controls.
 */
export function BrandMark({ compactBelow400 = true }: { compactBelow400?: boolean }) {
  return (
    <>
      <span className="shrink-0 rounded-md dark:ring-1 dark:ring-border">
        <AppLogo className="block size-7" />
      </span>
      <span
        className={cn(
          "text-base font-semibold tracking-tight",
          compactBelow400 && "max-[399px]:sr-only",
        )}
      >
        {APP_CONFIG.appName}
      </span>
    </>
  );
}
