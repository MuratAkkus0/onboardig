import { createAdmin } from "../../factories";
import { actorOf } from "../../helpers";

/** A valid 1x1 PNG. */
export const PNG_BYTES = new Uint8Array(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
  ),
);

export const PDF_BYTES = new Uint8Array(Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n"));

export async function adminActor(overrides: Parameters<typeof createAdmin>[0] = {}) {
  const user = await createAdmin(overrides);
  return { user, actor: actorOf(user) };
}
