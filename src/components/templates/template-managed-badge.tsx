import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

/** Who maintains the template: a team lead of its department or the admins. */
export function TemplateManagedBadge({ leadManaged }: { leadManaged: boolean }) {
  const t = useTranslations("templates.leadManaged");
  return (
    <Badge variant={leadManaged ? "secondary" : "outline"}>
      {leadManaged ? t("lead") : t("admin")}
    </Badge>
  );
}
