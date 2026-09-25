# 13: Agent Ticket Detail View and Conversation Transcript

**What to build:** Build the agent ticket management page at `/admin/tickets/[id]`. Agents can inspect full customer details, ticket metadata, the reason for escalation, and read the chronological transcript of messages exchanged between the customer and the AI assistant prior to escalation.

**Blocked by:** 12: Support Agent Dashboard and Queue Triage

**Status:** ready-for-agent

- [ ] Create `src/app/admin/tickets/[id]/page.tsx` protected by role guard (`agent` or `admin`).
- [ ] Render customer profile sidebar (name, email, registration date, previous ticket count).
- [ ] Display ticket summary banner showing escalation reason, current status, category, and priority.
- [ ] Render chronological transcript of all messages, including original AI chat turns and subsequent customer follow-ups.
- [ ] Provide back navigation link to the agent dashboard (`/admin`).
