import type { UserRole } from "@/db/schema";

export const STAFF_ROLES = ["agent", "admin"] as const satisfies readonly UserRole[];

export const STAFF_ONLY_MESSAGE =
  "This portal is for support staff only. Customers can sign in from the main site.";

export function isStaff(user: { role?: string | null }): boolean {
  return (STAFF_ROLES as readonly (string | null | undefined)[]).includes(user.role);
}

// Runs after credentials are accepted: anyone who is not staff has the session
// they just opened ended. Returns an error message, or null when allowed in.
export async function verifyStaffSignIn(
  user: { role?: string | null },
  signOut: () => Promise<unknown>,
): Promise<string | null> {
  if (isStaff(user)) return null;
  try {
    await signOut();
  } catch {
    // A leftover session only carries customer access, which /admin guards
    // reject anyway, so the refusal stands.
  }
  return STAFF_ONLY_MESSAGE;
}
