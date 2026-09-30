# 09: Transactional Email Notifications with Resend

**What to build:** Build the transactional email dispatch service using the Resend SDK. Support automated ticket creation receipts for customers, queue alerts for support agents, and notification emails when agents post public replies.

**Blocked by:** 02: Neon Database and Drizzle ORM Schema Setup

**Status:** done

- [x] Install `resend` package.
- [x] Create `src/lib/email.ts` initializing Resend client with `process.env.RESEND_API_KEY` (sent from `RESEND_FROM_EMAIL`; links use `NEXT_PUBLIC_APP_URL`).
- [x] Create email helper `sendTicketCreatedEmail({ to, customerName, ticketId, subject, reason })` (sent from `/api/chat` via `after()` when the AI escalates).
- [x] Create email helper `sendAgentAlertEmail({ ticketId, subject, priority, category })` (to `SUPPORT_TEAM_EMAIL`, for every new ticket per the spec; ADR 0002 mentions only critical/high).
- [x] Create email helper `sendAgentReplyNotificationEmail({ to, customerName, ticketId, replySnippet })` (called from ticket 14).
- [x] Integrate error handling and fallback logging so email failures never crash or rollback ticket operations (helpers log and return `false`, never throw; missing env vars skip the send with a warning).
