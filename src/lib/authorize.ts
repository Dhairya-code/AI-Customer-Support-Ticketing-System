import type { UserRole } from "@/db/schema";

export class AuthError extends Error {
  constructor(
    readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

// `role` is typed loosely because Better Auth types optional additional fields
// as nullable; anything outside `allowed` is rejected.
export function authorize<T extends { role?: string | null }>(
  user: T | null,
  allowed: readonly UserRole[],
): T {
  if (!user) {
    throw new AuthError(401, "Authentication required");
  }
  if (!user.role || !(allowed as readonly string[]).includes(user.role)) {
    throw new AuthError(403, "Insufficient permissions");
  }
  return user;
}
