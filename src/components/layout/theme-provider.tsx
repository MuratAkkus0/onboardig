"use client";

import { useEffect } from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { APP_CONFIG } from "@/config/app";

/** After sign-in the profile theme wins over whatever this browser stored for another user. */
function ThemeSync({ profileTheme }: { profileTheme: string | undefined }) {
  const { setTheme } = useTheme();
  useEffect(() => {
    if (profileTheme) setTheme(profileTheme);
  }, [profileTheme, setTheme]);
  return null;
}

export function ThemeProvider({
  profileTheme,
  children,
}: {
  profileTheme: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={profileTheme ?? APP_CONFIG.theme.default}
      enableSystem
      disableTransitionOnChange
    >
      <ThemeSync profileTheme={profileTheme} />
      {children}
    </NextThemesProvider>
  );
}
