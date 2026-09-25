# 12: Support Agent Dashboard and Queue Triage

**What to build:** Build the operational support dashboard at `/admin`. Authorized agents and admins can view ticket queue metrics (Total, Open, High/Critical, Resolved) and interact with a filterable ticket table with status, category, and priority filters.

**Blocked by:** 05: Discreet Staff Authentication Page, 08: Autonomous AI Ticket Escalation via Tool Calling

**Status:** ready-for-agent

- [ ] Create `src/app/admin/page.tsx` protected by role guard (`agent` or `admin`).
- [ ] Display aggregate metric cards (Total Tickets, Open Tickets, High/Critical Tickets, Resolved Tickets).
- [ ] Build ticket table with customer name, email, subject, category, priority, status, and creation date.
- [ ] Add client-side or searchParam filters for Status (`open`, `in_progress`, `resolved`, `closed`), Priority, and Category.
- [ ] Make table rows clickable, linking directly to `/admin/tickets/[id]`.
