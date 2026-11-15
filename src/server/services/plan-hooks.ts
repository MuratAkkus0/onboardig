import "server-only";
import type { Tx } from "@/server/db/client";
import type { PageStatus } from "@/lib/domain/page-status";

/*
 * Stub owned by F2a, implemented by W2-plans. This is the only coupling between content/org and
 * plans: content and org services call these hooks inside their own transaction and never import
 * the plan services. Until W2-plans lands every hook is a deliberate no-op.
 */

/** A published page's content changed: notify plan holders ("page updated", deduped). */
export async function onPublishedPageContentChanged(
  tx: Tx,
  input: { pageId: string; actorId: string },
): Promise<void> {
  void tx;
  void input;
}

/** A page changed status: recompute the onboarding status of every plan that contains it. */
export async function onPageStatusChanged(
  tx: Tx,
  input: { pageId: string; from: PageStatus; to: PageStatus; actorId: string },
): Promise<void> {
  void tx;
  void input;
}

/** Recomputes one user's onboarding status. The caller must already hold the user lock. */
export async function recomputeOnboardingStatusInTx(
  tx: Tx,
  input: { userId: string; notify?: boolean },
): Promise<void> {
  void tx;
  void input;
}
