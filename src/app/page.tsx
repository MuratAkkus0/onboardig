import { APP_CONFIG } from "@/config/app";

// Placeholder home page; replaced by the role redirect in F2b.
export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <h1 className="text-2xl font-semibold">{APP_CONFIG.appName}</h1>
    </main>
  );
}
