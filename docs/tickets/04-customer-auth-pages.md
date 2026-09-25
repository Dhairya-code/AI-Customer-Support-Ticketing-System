# 04: Customer Authentication Pages

**What to build:** Build modern customer sign-up (`/register`) and sign-in (`/login`) user interfaces using TailwindCSS. Handle credentials validation, loading states, error alerts, and redirect authenticated customers to the home support chat (`/`).

**Blocked by:** 03: Better Auth Integration and Role-Based Guards

**Status:** ready-for-agent

- [ ] Create `src/app/(auth)/register/page.tsx` with name, email, password fields and automatic role assignment (`customer`).
- [ ] Create `src/app/(auth)/login/page.tsx` with email and password fields, redirecting upon success.
- [ ] Implement client-side form validation and clean error display (e.g. invalid credentials, already registered email).
- [ ] Add navigation header with user profile indicator and Sign Out button for authenticated sessions.
