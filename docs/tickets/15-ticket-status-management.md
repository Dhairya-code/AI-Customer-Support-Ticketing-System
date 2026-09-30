# 15: Agent Ticket Lifecycle and Status Management

**What to build:** Build ticket management controls on `/admin/tickets/[id]` enabling agents to transition ticket statuses (`open` ➔ `in_progress` ➔ `resolved` ➔ `closed`), update priority, change category, and assign the ticket to an agent.

**Blocked by:** 13: Agent Ticket Detail View and Conversation Transcript

**Status:** done

- [x] Create status dropdown/button group to mutate ticket status with Server Action or API call (`TicketControls` in `src/app/admin/tickets/[id]/ticket-controls.tsx` → `changeTicketStatus` → `setTicketStatus` in `src/lib/staff-tickets.ts`).
- [x] Provide quick action buttons: "Mark In Progress", "Resolve Ticket", and "Close Ticket" (the button for the current status is hidden).
- [x] Create priority adjustment dropdown (`low`, `medium`, `high`, `critical`) and category selector (plus an assignee selector listing agents and admins; `triageTicket` → `updateTicketTriage`).
- [x] Record a system event message in the `messages` table when status changes (e.g., "Ticket marked as Resolved by Agent Alice") (worded "Ticket marked as Resolved by Alice"; customer-visible, `senderId` null per ADR 0002).
- [x] Revalidate ticket view and dashboard metrics upon status update (`refresh()` for the ticket page, `revalidatePath("/admin")` for the dashboard; also on priority/category/assignee changes).

**Notes for later tickets:** `open`, `in_progress` and `resolved` move freely in any direction, but `closed` is final, per CONTEXT.md ("finalized and locked"): its status can't change, though priority, category and assignee still can. Only status changes leave a message; priority, category and assignee changes leave no trace in the thread. Agent replies don't move `open` tickets to `in_progress`. Ticket 16 expects `resolved` tickets to disable replies, but ticket 11 deliberately keeps them open to customer replies (only `closed` locks the thread); settle that before verifying it. Enum value arrays now live in `src/db/enums.ts` (re-exported from `schema.ts`) so client components can import them, and display labels in `src/lib/ticket-labels.ts`.
