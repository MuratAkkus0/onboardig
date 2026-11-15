import { Button, Heading, Hr, Link, Text } from "react-email";
import type { Locale } from "@/server/auth/types";
import { EmailLayout } from "./layout";

const buttonStyle = {
  border: "1px solid currentColor",
  borderRadius: "6px",
  display: "inline-block",
  fontWeight: "bold",
  padding: "12px 20px",
  textDecoration: "none",
};
const smallStyle = { fontSize: "13px", opacity: 0.75 };

export interface ActionMailTexts {
  preview: string;
  heading: string;
  greeting: string;
  intro: string;
  button: string;
  expiry: string;
  fallback: string;
  ignore: string;
}

/** Shared body of the "click this button" mails (invite, password reset). */
export function ActionMail({
  locale,
  url,
  texts,
}: {
  locale: Locale;
  url: string;
  texts: ActionMailTexts;
}) {
  return (
    <EmailLayout locale={locale} preview={texts.preview}>
      <Heading as="h1">{texts.heading}</Heading>
      <Text>{texts.greeting}</Text>
      <Text>{texts.intro}</Text>
      <Button href={url} style={buttonStyle}>
        {texts.button}
      </Button>
      <Text style={smallStyle}>{texts.expiry}</Text>
      <Hr />
      <Text style={smallStyle}>{texts.fallback}</Text>
      <Text style={smallStyle}>
        <Link href={url}>{url}</Link>
      </Text>
      <Text style={smallStyle}>{texts.ignore}</Text>
    </EmailLayout>
  );
}
