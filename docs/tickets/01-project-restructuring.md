# 01: Project Restructuring and Monorepo Cleanup

**What to build:** Reorganize the workspace into a clean Next.js App Router application with `src/` directory convention. Consolidate root `package.json`, remove legacy `backend/` (FastAPI) and `frontend/` folders, and verify that the base Next.js application compiles cleanly.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Move frontend Next.js configuration files (`next.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `eslint.config.mjs`, `package.json`) to the root workspace directory.
- [ ] Establish `src/app`, `src/components`, `src/lib`, `src/db`, and `src/types` directory layout.
- [ ] Safely remove legacy Python `backend/` and redundant nested `frontend/` folders.
- [ ] Configure Tailwind CSS v4 in `src/app/globals.css`.
- [ ] Verify `npm run build` succeeds without build errors.
