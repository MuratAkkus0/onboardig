"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LOCALES } from "@/config/app";
import { setLocaleAction } from "@/server/actions/preferences";

type Variant = "menu" | "field" | "select";

/**
 * de / en. Signed in: stored on the profile; always: NEXT_LOCALE cookie (works on the login page).
 * "select" is the compact variant for the signed-out pages.
 */
export function LocaleSwitcher({ variant, id }: { variant: Variant; id?: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function change(next: string) {
    startTransition(async () => {
      const result = await setLocaleAction(next);
      if (!result.ok) {
        toast.error(t("profile.saveFailed"));
        return;
      }
      router.refresh();
    });
  }

  if (variant === "menu") {
    return (
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>{t("nav.userMenu.language")}</DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuRadioGroup value={locale} onValueChange={change}>
            {LOCALES.map((value) => (
              <DropdownMenuRadioItem key={value} value={value}>
                {t(`enums.locale.${value}`)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    );
  }

  if (variant === "select") {
    return (
      <Select value={locale} onValueChange={change} disabled={pending}>
        <SelectTrigger id={id} size="sm" aria-label={t("nav.userMenu.language")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LOCALES.map((value) => (
            <SelectItem key={value} value={value}>
              {t(`enums.locale.${value}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <RadioGroup
      value={locale}
      onValueChange={change}
      disabled={pending}
      aria-label={t("profile.preferences.language")}
    >
      {LOCALES.map((value) => (
        <div key={value} className="flex items-center gap-2">
          <RadioGroupItem value={value} id={`locale-${value}`} />
          <Label htmlFor={`locale-${value}`}>{t(`enums.locale.${value}`)}</Label>
        </div>
      ))}
    </RadioGroup>
  );
}
