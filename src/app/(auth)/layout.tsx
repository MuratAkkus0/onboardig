import { AppLogo } from "@/components/layout/app-logo";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { APP_CONFIG } from "@/config/app";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between p-4">
        <span className="flex items-center gap-2 text-base font-semibold">
          <AppLogo className="size-6 shrink-0" />
          {APP_CONFIG.appName}
        </span>
        <LocaleSwitcher variant="select" />
      </header>
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4">{children}</div>
      </main>
    </div>
  );
}
