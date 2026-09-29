# 05: Discreet Staff Authentication Page

**What to build:** Build an unlisted staff authentication interface at `/admin/login` restricted exclusively to users with `agent` or `admin` roles. Block customers from signing in via this portal and redirect authorized staff to the operational dashboard (`/admin`).

**Blocked by:** 03: Better Auth Integration and Role-Based Guards

**Status:** done

- [x] Create `src/app/admin/login/page.tsx` with dedicated staff login styling.
- [x] Authenticate staff credentials using Better Auth.
- [x] Inspect user role post-authentication: if role is `customer`, reject login with an explicit authorization error message and terminate the session (in `src/lib/staff-auth.ts`).
- [x] Redirect authenticated `agent` or `admin` users directly to `/admin` dashboard (placeholder page guarded by `requireStaffPage`; ticket 12 fills it in).
