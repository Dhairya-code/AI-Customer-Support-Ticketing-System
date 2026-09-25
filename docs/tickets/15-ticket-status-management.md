# 15: Agent Ticket Lifecycle and Status Management

**What to build:** Build ticket management controls on `/admin/tickets/[id]` enabling agents to transition ticket statuses (`open` ➔ `in_progress` ➔ `resolved` ➔ `closed`), update priority, change category, and assign the ticket to an agent.

**Blocked by:** 13: Agent Ticket Detail View and Conversation Transcript

**Status:** ready-for-agent

- [ ] Create status dropdown/button group to mutate ticket status with Server Action or API call.
- [ ] Provide quick action buttons: "Mark In Progress", "Resolve Ticket", and "Close Ticket".
- [ ] Create priority adjustment dropdown (`low`, `medium`, `high`, `critical`) and category selector.
- [ ] Record a system event message in the `messages` table when status changes (e.g., "Ticket marked as Resolved by Agent Alice").
- [ ] Revalidate ticket view and dashboard metrics upon status update.
