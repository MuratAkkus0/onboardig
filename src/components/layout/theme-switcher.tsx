"use client";

import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
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

type Variant = "menu" | "field";

/** Light / dark / system. Applies immediately (next-themes) and persists to the profile. */
export function ThemeSwitcher({ variant }: { variant: Variant }) {
  const t = useTranslations();
  const { theme, setTheme } = useTheme();
  const current = THEMES.find((value) => value === theme) ?? "system";

  async function change(next: string) {
    setTheme(next);
    const result = await setThemeAction(next);
    if (!result.ok) toast.error(t("profile.saveFailed"));
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
