import type { Messages } from "next-intl";
import type { Locale } from "@/server/auth/types";
import { NAMESPACES } from "./namespaces";

/** Loads messages/<locale>/<namespace>.json for every namespace and nests them by namespace name. */
export async function loadMessages(locale: Locale): Promise<Messages> {
  const entries = await Promise.all(
    NAMESPACES.map(async (namespace) => {
      const loaded = (await import(`../../messages/${locale}/${namespace}.json`)) as {
        default: Record<string, unknown>;
      };
      return [namespace, loaded.default] as const;
    }),
  );
  return Object.fromEntries(entries) as Messages;
}
