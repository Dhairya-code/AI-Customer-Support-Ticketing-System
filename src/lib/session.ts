import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
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

// For pages only signed-out visitors need, such as /login and /register.
// Called from pages rather than a layout because layouts don't re-run on
// client-side navigation.
export async function redirectIfSignedIn(): Promise<void> {
  if (await getCurrentUser()) {
    redirect("/");
  }
}

// Any signed-in user, staff included.
export async function requireUser(): Promise<SessionUser> {
  return requireRole(USER_ROLES);
}
