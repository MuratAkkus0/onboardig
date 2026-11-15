import type { ReactNode } from "react";
import { Body, Container, Head, Html, Preview } from "react-email";
import type { Locale } from "@/server/auth/types";

// No color values on purpose: mail clients cannot resolve the CSS variables of tokens.css, so
// the templates stay neutral and inherit the client's own colors.
const bodyStyle = { fontFamily: "Helvetica, Arial, sans-serif", margin: 0, padding: "24px 0" };
const containerStyle = { maxWidth: "560px", margin: "0 auto", padding: "0 24px" };

export function EmailLayout({
  locale,
  preview,
  children,
}: {
  locale: Locale;
  preview: string;
  children: ReactNode;
}) {
  return (
    <Html lang={locale}>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>{children}</Container>
      </Body>
    </Html>
  );
}
