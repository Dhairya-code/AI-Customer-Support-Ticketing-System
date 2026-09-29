import "server-only";
import { headers } from "next/headers";
import { cache } from "react";
import { USER_ROLES, type UserRole } from "@/db/schema";
import { auth, type SessionUser } from "./auth";
import { authorize } from "./authorize";

export { AuthError } from "./authorize";

// Cached per request so layouts, pages and actions share one session lookup.
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
});

// Guards throw AuthError (401 when signed out, 403 when the role is not
// allowed); callers map it to a redirect or HTTP response.
export async function requireRole(
  allowed: readonly UserRole[],
): Promise<SessionUser> {
  return authorize(await getCurrentUser(), allowed);
}

// Any signed-in user, staff included.
export async function requireUser(): Promise<SessionUser> {
  return requireRole(USER_ROLES);
}
