# 12: Support Agent Dashboard and Queue Triage

**What to build:** Build the operational support dashboard at `/admin`. Authorized agents and admins can view ticket queue metrics (Total, Open, High/Critical, Resolved) and interact with a filterable ticket table with status, category, and priority filters.

**Blocked by:** 05: Discreet Staff Authentication Page, 08: Autonomous AI Ticket Escalation via Tool Calling

**Status:** done

- [x] Create `src/app/admin/page.tsx` protected by role guard (`agent` or `admin`) (`requireStaffPage`: anyone else lands on `/admin/login`).
- [x] Display aggregate metric cards (Total Tickets, Open Tickets, High/Critical Tickets, Resolved Tickets) (`getQueueMetrics` in `src/lib/staff-tickets.ts`; counts the whole queue regardless of filters).
- [x] Build ticket table with customer name, email, subject, category, priority, status, and creation date (`listQueueTickets`, newest first).
- [x] Add client-side or searchParam filters for Status (`open`, `in_progress`, `resolved`, `closed`), Priority, and Category (searchParams via a plain GET form; unknown values are ignored by `parseQueueFilters`).
- [x] Make table rows clickable, linking directly to `/admin/tickets/[id]`.

**Notes for later tickets:** "Open Tickets" counts `status = open` only, not `in_progress`; "High/Critical" counts every status. The legacy `src/app/agent/page.tsx` (fetches from the old Python backend) is now superseded by `/admin`.
