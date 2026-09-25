# 16: End-to-End Verification and Polish

**What to build:** Conduct full end-to-end verification of the migrated system. Validate the entire customer journey from sign-up, AI chat, automatic escalation, email notification, customer ticket tracking, agent triage, public replies, internal notes, and status transitions, ensuring a responsive, premium UI.

**Blocked by:** 11: Customer Ticket Conversation Thread & Replies, 14: Agent Public Replies and Internal Team Notes, 15: Agent Ticket Lifecycle and Status Management

**Status:** ready-for-agent

- [ ] Verify customer sign-up, login, and session persistence across page refreshes.
- [ ] Test conversational AI turns: verify FAQ questions receive instant direct answers without creating a ticket.
- [ ] Test escalation trigger: simulate a payment failure or "I need a human agent" message; verify Gemini invokes `create_ticket` and returns the new ticket ID.
- [ ] Verify the new ticket appears in both Customer `/tickets` and Agent `/admin` queues.
- [ ] Test agent public reply: verify it renders on the customer ticket page and triggers the Resend email function.
- [ ] Test agent internal note: verify it appears with yellow/amber styling on `/admin/tickets/[id]` and is completely hidden from customer `/tickets/[id]`.
- [ ] Test ticket lifecycle transitions: verify moving ticket to `resolved` and `closed` disables replies and updates metrics.
- [ ] Audit responsive styling and glassmorphic / modern design elements on mobile and desktop viewports.
