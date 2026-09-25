# 10: Customer "My Tickets" Overview

**What to build:** Build the customer ticket management portal at `/tickets`. Logged-in customers can view all tickets they have submitted, see priority badges, category tags, current status (`open`, `in_progress`, `resolved`, `closed`), creation dates, and navigate into individual ticket conversations.

**Blocked by:** 04: Customer Authentication Pages, 08: Autonomous AI Ticket Escalation via Tool Calling

**Status:** ready-for-agent

- [ ] Create `src/app/(customer)/tickets/page.tsx` with server-side session authentication.
- [ ] Query Drizzle ORM for tickets where `userId === session.user.id`, ordered by `createdAt` descending.
- [ ] Display tickets in a responsive card/table layout with status badges, category pills, and priority indicators.
- [ ] Provide an empty state ("No support tickets found") with a call-to-action button linking back to AI chat (`/`).
- [ ] Include navigation links between Support Chat and "My Tickets".
