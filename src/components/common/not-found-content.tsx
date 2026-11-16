import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import { ROUTES } from "@/config/app";

/** 404 content; the root variant is its own landmark, inside the app shell it sits in `main`. */
export async function NotFoundContent({ as: Tag = "main" }: { as?: "main" | "div" }) {
  const t = await getTranslations("common");
  return (
    <Tag
      className={
        Tag === "main"
          ? "mx-auto flex min-h-screen max-w-xl items-center p-6"
          : "mx-auto flex max-w-xl items-center py-12"
      }
    >
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
    </Tag>
  );
}
