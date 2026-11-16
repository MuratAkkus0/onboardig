"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { hasInAppHistory } from "@/lib/in-app-history";

/**
 * Returns to the previous in-app page (plan, search, library, ...). When the page was opened
 * directly (new tab, bookmark), it goes to `fallbackHref` instead of leaving the app.
 */
export function BackButton({ fallbackHref }: { fallbackHref: string }) {
  const t = useTranslations("common.actions");
  const router = useRouter();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="-ml-2 text-muted-foreground"
      onClick={() => (hasInAppHistory() ? router.back() : router.push(fallbackHref))}
    >
      <ArrowLeft aria-hidden="true" />
      {t("back")}
    </Button>
  );
}
