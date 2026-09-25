# 09: Transactional Email Notifications with Resend

**What to build:** Build the transactional email dispatch service using the Resend SDK. Support automated ticket creation receipts for customers, queue alerts for support agents, and notification emails when agents post public replies.

**Blocked by:** 02: Neon Database and Drizzle ORM Schema Setup

**Status:** ready-for-agent

- [ ] Install `resend` package.
- [ ] Create `src/lib/email.ts` initializing Resend client with `process.env.RESEND_API_KEY`.
- [ ] Create email helper `sendTicketCreatedEmail({ to, customerName, ticketId, subject, reason })`.
- [ ] Create email helper `sendAgentAlertEmail({ ticketId, subject, priority, category })`.
- [ ] Create email helper `sendAgentReplyNotificationEmail({ to, customerName, ticketId, replySnippet })`.
- [ ] Integrate error handling and fallback logging so email failures never crash or rollback ticket operations.
