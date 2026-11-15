import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadMessages } from "@/i18n/messages";
import { NAMESPACES } from "@/i18n/namespaces";
import type { Actor } from "@/server/auth/types";

const state = vi.hoisted(() => ({
  actor: null as Actor | null,
  cookie: undefined as string | undefined,
  acceptLanguage: null as string | null,
}));

vi.mock("@/server/auth/actor", () => ({ getActor: async () => state.actor }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (state.cookie ? { value: state.cookie } : undefined),
  }),
  headers: async () =>
    new Headers(state.acceptLanguage ? { "accept-language": state.acceptLanguage } : {}),
}));

const { resolveLocale } = await import("@/i18n/locale");

describe("resolveLocale", () => {
  beforeEach(() => {
    state.actor = null;
    state.cookie = undefined;
    state.acceptLanguage = null;
  });

  it("prefers the profile locale of a signed-in user", async () => {
    state.actor = { locale: "en" } as Actor;
    state.cookie = "de";
    expect(await resolveLocale()).toBe("en");
  });

  it("uses the cookie, then the browser language, then German", async () => {
    state.cookie = "en";
    state.acceptLanguage = "de-DE,de;q=0.9";
    expect(await resolveLocale()).toBe("en");

    state.cookie = "fr";
    state.acceptLanguage = "fr-FR,en-US;q=0.8";
    expect(await resolveLocale()).toBe("en");

    state.acceptLanguage = "fr-FR,es;q=0.8";
    expect(await resolveLocale()).toBe("de");
  });
});

describe("loadMessages", () => {
  it.each(["de", "en"] as const)("nests every namespace file for %s", async (locale) => {
    const messages = await loadMessages(locale);
    expect(Object.keys(messages).sort()).toEqual([...NAMESPACES].sort());
    expect(messages.errors.FORBIDDEN).toBeTruthy();
  });
});
