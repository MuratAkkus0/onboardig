import "server-only";

export type InvitationTokenCheck =
  | { valid: true; email: string; firstName: string }
  | { valid: false; reason: "invalid" | "expired" | "used" };

/** Contract stub: implemented by F2a. */
export async function verifyInvitationToken(token: string): Promise<InvitationTokenCheck> {
  void token;
  throw new Error("not implemented: F2a");
}

/** Contract stub: implemented by F2a. */
export async function acceptInvitation(input: {
  token: string;
  password: string;
}): Promise<{ email: string }> {
  void input;
  throw new Error("not implemented: F2a");
}
