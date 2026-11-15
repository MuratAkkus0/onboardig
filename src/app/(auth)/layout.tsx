import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { APP_CONFIG } from "@/config/app";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between p-4">
        <span className="text-base font-semibold">{APP_CONFIG.appName}</span>
        <LocaleSwitcher variant="select" />
      </header>
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4">{children}</div>
      </main>
    </div>
  );
}
