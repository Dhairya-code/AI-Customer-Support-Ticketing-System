# 02: Neon Database and Drizzle ORM Schema Setup

**What to build:** Configure serverless Neon PostgreSQL connectivity using Drizzle ORM (`drizzle-orm/neon-http`, `drizzle-kit`, `@neondatabase/serverless`). Define complete schemas for users, sessions, accounts, verifications, tickets, and threaded messages.

**Blocked by:** 01: Project Restructuring and Monorepo Cleanup

**Status:** ready-for-agent

- [ ] Install `drizzle-orm`, `@neondatabase/serverless`, and `drizzle-kit` as dev dependency.
- [ ] Create `drizzle.config.ts` targeting PostgreSQL schema and migrations directory.
- [ ] Create `src/db/index.ts` initializing Drizzle client with `process.env.DATABASE_URL` via Neon HTTP driver.
- [ ] Define tables in `src/db/schema.ts`:
  - Better Auth tables: `user` (with `role`: `"customer" | "agent" | "admin"`), `session`, `account`, `verification`.
  - `tickets` table with `id`, `userId`, `subject`, `category`, `priority`, `status`, `escalationReason`, `assignedToId`, `createdAt`, `updatedAt`.
  - `messages` table with `id`, `ticketId`, `senderId`, `senderType`, `content`, `isInternal`, `createdAt`.
- [ ] Validate schema compilation and exports with TypeScript.
