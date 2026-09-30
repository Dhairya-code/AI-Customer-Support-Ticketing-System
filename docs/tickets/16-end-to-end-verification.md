# 16: End-to-End Verification and Polish

**What to build:** Conduct full end-to-end verification of the migrated system. Validate the entire customer journey from sign-up, AI chat, automatic escalation, email notification, customer ticket tracking, agent triage, public replies, internal notes, and status transitions, ensuring a responsive, premium UI.

**Blocked by:** 11: Customer Ticket Conversation Thread & Replies, 14: Agent Public Replies and Internal Team Notes, 15: Agent Ticket Lifecycle and Status Management

**Status:** done

- [x] Verify customer sign-up, login, and session persistence across page refreshes (the auth client no longer pins `NEXT_PUBLIC_APP_URL`, so it always calls its own origin, and the auth forms no longer hang when a request can't reach the server).
- [x] Test conversational AI turns: verify FAQ questions receive instant direct answers without creating a ticket.
- [x] Test escalation trigger: simulate a payment failure or "I need a human agent" message; verify Gemini invokes `create_ticket` and returns the new ticket ID.
- [x] Verify the new ticket appears in both Customer `/tickets` and Agent `/admin` queues.
- [x] Test agent public reply: verify it renders on the customer ticket page and triggers the Resend email function (verified through the server log, since Resend isn't configured locally).
- [x] Test agent internal note: verify it appears with yellow/amber styling on `/admin/tickets/[id]` and is completely hidden from customer `/tickets/[id]` (absent from both the HTML and the RSC payload).
- [x] Test ticket lifecycle transitions: verify moving ticket to `resolved` and `closed` disables replies and updates metrics (only `closed` disables replies; see below).
- [x] Audit responsive styling and glassmorphic / modern design elements on mobile and desktop viewports (no page overflows at 375px; status badges no longer stretch full-width on narrow screens).

**Notes:** a `resolved` ticket keeps accepting customer replies, as ticket 11 and CONTEXT.md intend ("awaiting confirmation"); only `closed` locks the thread. Timestamps rendered on the server stayed in UTC after hydration, while those rendered later on the client were local, so `LocalDate` now re-renders in the viewer's timezone once hydrated. The dashboard's "Resolved Tickets" metric counts `resolved` only, so closing a ticket removes it from that count. The project is now named ResolveAI (name only, no domain), and `README.md` has setup steps and a manual testing guide. The pre-migration `src/app/agent/page.tsx`, which fetched the old FastAPI backend, has been removed.
