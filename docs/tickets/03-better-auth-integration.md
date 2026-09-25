# 03: Better Auth Integration and Role-Based Guards

**What to build:** Configure Better Auth with the Drizzle ORM adapter. Support email and password authentication, user roles (`customer`, `agent`, `admin`), session verification, and role-based protection utilities for server actions and routes.

**Blocked by:** 02: Neon Database and Drizzle ORM Schema Setup

**Status:** ready-for-agent

- [ ] Install `better-auth` and `@better-auth/drizzle-adapter`.
- [ ] Create `src/lib/auth.ts` configuring Better Auth instance with Drizzle adapter, email/password provider, and user role field.
- [ ] Create `src/lib/auth-client.ts` exporting client auth methods (`signIn`, `signUp`, `signOut`, `useSession`).
- [ ] Create API route handler `src/app/api/auth/[...all]/route.ts` bridging Better Auth endpoints.
- [ ] Implement server-side session helper `getCurrentUser()` and role-guard helper `requireRole(["agent", "admin"])`.
