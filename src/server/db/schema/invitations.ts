import { index, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { createdAt, primaryUuid, timestamptz } from "./custom-types";

export const invitations = pgTable(
  "invitations",
  {
    id: primaryUuid(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamptz("expires_at").notNull(),
    acceptedAt: timestamptz("accepted_at"),
    revokedAt: timestamptz("revoked_at"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    unique("invitations_token_hash_uq").on(t.tokenHash),
    index("invitations_user_id_idx").on(t.userId),
  ],
);
