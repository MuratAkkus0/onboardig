"use client";

import { ErrorState } from "@/components/common/error-state";

export default function RootError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center p-6">
      <ErrorState className="w-full" onRetry={reset} />
    </main>
  );
}
