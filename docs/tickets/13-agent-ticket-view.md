# 13: Agent Ticket Detail View and Conversation Transcript

**What to build:** Build the agent ticket management page at `/admin/tickets/[id]`. Agents can inspect full customer details, ticket metadata, the reason for escalation, and read the chronological transcript of messages exchanged between the customer and the AI assistant prior to escalation.

**Blocked by:** 12: Support Agent Dashboard and Queue Triage

**Status:** done

- [x] Create `src/app/admin/tickets/[id]/page.tsx` protected by role guard (`agent` or `admin`) (`requireStaffPage`; an unknown or invalid id is a 404).
- [x] Render customer profile sidebar (name, email, registration date, previous ticket count) (`getStaffTicketDetail` in `src/lib/staff-tickets.ts`; "previous" means tickets this customer opened before this one).
- [x] Display ticket summary banner showing escalation reason, current status, category, and priority.
- [x] Render chronological transcript of all messages, including original AI chat turns and subsequent customer follow-ups.
- [x] Provide back navigation link to the agent dashboard (`/admin`).

**Notes for later tickets:** the transcript already includes internal notes, shown in amber and labelled "Internal note · {agent name}"; ticket 14 should switch that label to its "Internal Note - Only Staff Can See" badge. Agent messages show the sender's name (`senderName`), falling back to "Support agent".
