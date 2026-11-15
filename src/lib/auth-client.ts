import { createAuthClient } from "better-auth/react";

// No adminClient(): the admin endpoints are disabled server-side (users are managed by our services).
export const authClient = createAuthClient();
