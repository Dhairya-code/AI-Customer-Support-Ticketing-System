# ADR 0001: Migration to Unified Fullstack Next.js with Drizzle, Neon, and Better Auth

## Status
Accepted

## Context
The legacy application was split into two separate directories:
1. `backend/`: FastAPI + SQLite (`support.db`) with raw SQL / SQLAlchemy mix and partial Gemini Python classification.
2. `frontend/`: Next.js 16 (React 19) + Tailwind CSS v4, containing a simple customer chat and an incomplete agent dashboard.

This separation created maintenance overhead, lacked shared TypeScript types, had out-of-sync schemas, and suffered from fragmented database queries. Furthermore, authentication was missing and chat transcripts were not persisted.

## Decision
1. **Unified Fullstack Next.js**:
   - Retire the Python FastAPI backend completely.
   - Consolidate all frontend UI, Server Actions, API routes, and AI orchestration into a single Next.js App Router repository.
   - Run Next.js with TypeScript and React 19.

2. **Database & ORM**:
   - Adopt **Neon PostgreSQL** (serverless connection pooling via `@neondatabase/serverless`).
   - Use **Drizzle ORM** (`drizzle-orm`, `drizzle-kit`) for type-safe schema declarations, migrations, and relationship queries.

3. **Authentication**:
   - Use **Better Auth** (`better-auth`) with the official Drizzle adapter.
   - Support email and password authentication.
   - Implement role-based access (`customer`, `agent`, `admin`).
   - Customer login exposed on standard user routes (`/login`, `/register`); Agent/Admin login restricted to non-linked paths (`/admin/login`).

4. **AI First-Contact & Escalation**:
   - Implement Gemini directly within Next.js API/Server Actions.
   - AI conversational loop answers customer queries until critical threshold or explicit escalation request is triggered, at which point a `Ticket` is raised with automatic classification.

5. **Notification**:
   - Resend API used for customer acknowledgment and agent notification emails upon ticket creation and replies.

## Consequences
- Single language and build system (TypeScript) across the entire stack.
- Database access is direct and fully type-safe with Drizzle.
- Eliminates the need to maintain a separate Python environment and CORS setup.
- Enables serverless deployment (e.g. Vercel) connecting to Neon Postgres.
