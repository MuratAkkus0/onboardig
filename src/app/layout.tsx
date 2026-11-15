import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { APP_CONFIG } from "@/config/app";
import { getActor } from "@/server/auth/actor";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: APP_CONFIG.appName, template: `%s | ${APP_CONFIG.appName}` },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const actor = await getActor();
  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <NextIntlClientProvider>
          <ThemeProvider profileTheme={actor?.theme}>
            {children}
            <Toaster />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
