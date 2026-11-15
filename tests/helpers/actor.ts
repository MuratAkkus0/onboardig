import type { Actor } from "@/server/auth/types";
import type { User } from "@/server/db/types";

export function actorOf(user: User): Actor {
  return {
    id: user.id,
    role: user.role,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    locale: user.locale,
    theme: user.theme,
  };
}
