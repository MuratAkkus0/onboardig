import { W1_CONTENT_CONFIG } from "@/config/app";

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/** Links may only use the protocols from W1_CONTENT_CONFIG (http, https, mailto). */
export function isAllowedHref(href: string): boolean {
  const value = href.trim();
  if (value === "" || CONTROL_CHARS.test(value)) return false;
  try {
    const { protocol } = new URL(value);
    return (W1_CONTENT_CONFIG.allowedLinkProtocols as readonly string[]).includes(protocol);
  } catch {
    return false;
  }
}
