import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import { ROUTES } from "@/config/app";

export default async function NotFound() {
  const t = await getTranslations("common");
  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center p-6">
      <EmptyState
        className="w-full"
        title={t("states.notFoundTitle")}
        description={t("states.notFoundDescription")}
        action={
          <Button asChild variant="outline">
            <Link href={ROUTES.home}>{t("actions.backToStart")}</Link>
          </Button>
        }
      />
    </main>
  );
}
