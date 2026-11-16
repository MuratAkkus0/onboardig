"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { THEMES } from "@/config/app";
import { setThemeAction } from "@/server/actions/preferences";

type Variant = "menu" | "field" | "icon";

const subscribeNothing = () => () => undefined;

/** False during SSR and hydration, true afterwards (next-themes only knows the theme on the client). */
function useMounted(): boolean {
  return useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
}

interface ThemeSwitcherProps {
  variant: Variant;
  /**
   * Store the choice on the profile (default). Signed-out pages pass false: there is no actor, so
   * the action would fail; next-themes still keeps the choice in the browser.
   */
  persist?: boolean;
}

/**
 * Light / dark / system. Applies immediately (next-themes); with `persist` (default) it is also
 * saved to the profile. Signed-out pages pass `persist={false}`, as there is no profile to save to.
 */
export function ThemeSwitcher({ variant, persist = true }: ThemeSwitcherProps) {
  const t = useTranslations();
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const current = (mounted && THEMES.find((value) => value === theme)) || "system";

  async function change(next: string) {
    setTheme(next);
    if (!persist) return;
    const result = await setThemeAction(next);
    if (!result.ok) toast.error(t("profile.saveFailed"));
  }

  if (variant === "icon") {
    // Sun/Moon switch by the .dark class (CSS), so server and client render the same markup.
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t("nav.userMenu.theme")}>
            <Sun className="dark:hidden" aria-hidden />
            <Moon className="hidden dark:block" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuRadioGroup value={current} onValueChange={change}>
            {THEMES.map((value) => (
              <DropdownMenuRadioItem key={value} value={value}>
                {t(`enums.theme.${value}`)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (variant === "menu") {
    return (
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>{t("nav.userMenu.theme")}</DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuRadioGroup value={current} onValueChange={change}>
            {THEMES.map((value) => (
              <DropdownMenuRadioItem key={value} value={value}>
                {t(`enums.theme.${value}`)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    );
  }

  return (
    <RadioGroup value={current} onValueChange={change} aria-label={t("profile.preferences.theme")}>
      {THEMES.map((value) => (
        <div key={value} className="flex items-center gap-2">
          <RadioGroupItem value={value} id={`theme-${value}`} />
          <Label htmlFor={`theme-${value}`}>{t(`enums.theme.${value}`)}</Label>
        </div>
      ))}
    </RadioGroup>
  );
}
