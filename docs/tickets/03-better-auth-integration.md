# 03: Better Auth Integration and Role-Based Guards

**What to build:** Configure Better Auth with the Drizzle ORM adapter. Support email and password authentication, user roles (`customer`, `agent`, `admin`), session verification, and role-based protection utilities for server actions and routes.

**Blocked by:** 02: Neon Database and Drizzle ORM Schema Setup

**Status:** done

- [x] Install `better-auth` and `@better-auth/drizzle-adapter`.
- [x] Create `src/lib/auth.ts` configuring Better Auth instance with Drizzle adapter, email/password provider, and user role field.
- [x] Create `src/lib/auth-client.ts` exporting client auth methods (`signIn`, `signUp`, `signOut`, `useSession`).
- [x] Create API route handler `src/app/api/auth/[...all]/route.ts` bridging Better Auth endpoints.
- [x] Implement server-side session helper `getCurrentUser()` and role-guard helper `requireRole(["agent", "admin"])` (in `src/lib/session.ts`; throws `AuthError` with 401/403).
