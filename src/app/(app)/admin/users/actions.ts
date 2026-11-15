"use server";

import { revalidatePath } from "next/cache";
import { ROUTES } from "@/config/app";
import type { ActionResult } from "@/lib/action-result";
import type {
  CreateUserInput,
  DeleteUserPermanentlyInput,
  UpdateUserInput,
  UserIdInput,
} from "@/lib/validation/users";
import { runAction } from "@/server/actions/run-action";
import { resendInvitation } from "@/server/services/invitations";
import {
  createUser,
  deactivateUser,
  deleteUserPermanently,
  reactivateUser,
  updateUser,
} from "@/server/services/users";

function revalidateUsers(userId?: string): void {
  revalidatePath(ROUTES.adminUsers);
  if (userId) revalidatePath(ROUTES.adminUser(userId));
}

export async function createUserAction(
  input: CreateUserInput,
): Promise<ActionResult<{ id: string; inviteSent: boolean }>> {
  return runAction(async (actor) => {
    const { user, inviteSent } = await createUser(actor, input);
    revalidateUsers();
    return { id: user.id, inviteSent };
  });
}

export async function updateUserAction(
  input: UpdateUserInput,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async (actor) => {
    const user = await updateUser(actor, input);
    revalidateUsers(user.id);
    return { id: user.id };
  });
}

export async function resendInvitationAction(
  input: UserIdInput,
): Promise<ActionResult<{ sent: boolean }>> {
  return runAction(async (actor) => {
    const { sent } = await resendInvitation(actor, { userId: input.id });
    revalidateUsers(input.id);
    return { sent };
  });
}

export async function deactivateUserAction(input: UserIdInput): Promise<ActionResult> {
  return runAction(async (actor) => {
    await deactivateUser(actor, input);
    revalidateUsers(input.id);
  });
}

export async function reactivateUserAction(input: UserIdInput): Promise<ActionResult> {
  return runAction(async (actor) => {
    await reactivateUser(actor, input);
    revalidateUsers(input.id);
  });
}

export async function deleteUserPermanentlyAction(
  input: DeleteUserPermanentlyInput,
): Promise<ActionResult> {
  return runAction(async (actor) => {
    await deleteUserPermanently(actor, input);
    revalidateUsers();
  });
}
