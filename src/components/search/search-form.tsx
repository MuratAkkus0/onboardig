import { Search } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { W3_SEARCH_CONFIG } from "@/config/app";

/** Plain GET form (works without client JS); the query lives in the URL as `?q=`. */
export async function SearchForm({ defaultValue }: { defaultValue: string }) {
  const t = await getTranslations("search");
  return (
    <form action="/search" method="get" role="search" className="mb-8 flex max-w-2xl gap-2">
      <Label htmlFor="search-q" className="sr-only">
        {t("label")}
      </Label>
      <Input
        id="search-q"
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder={t("placeholder")}
        maxLength={W3_SEARCH_CONFIG.queryMaxLength}
        autoComplete="off"
      />
      <Button type="submit">
        <Search aria-hidden="true" />
        {t("submit")}
      </Button>
    </form>
  );
}
