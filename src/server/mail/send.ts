import "server-only";
import type { ReactElement } from "react";
import { render } from "react-email";
import { deliver } from "./transport";

/** Renders a React Email element (HTML + plain text) and sends it. Never logs the body. */
export async function sendMail(input: {
  to: string;
  subject: string;
  react: ReactElement;
}): Promise<void> {
  const [html, text] = await Promise.all([
    render(input.react),
    render(input.react, { plainText: true }),
  ]);
  await deliver({ to: input.to, subject: input.subject, html, text });
}
