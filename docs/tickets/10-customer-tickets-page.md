# 10: Customer "My Tickets" Overview

**What to build:** Build the customer ticket management portal at `/tickets`. Logged-in customers can view all tickets they have submitted, see priority badges, category tags, current status (`open`, `in_progress`, `resolved`, `closed`), creation dates, and navigate into individual ticket conversations.

**Blocked by:** 04: Customer Authentication Pages, 08: Autonomous AI Ticket Escalation via Tool Calling

**Status:** done

- [x] Create `src/app/(customer)/tickets/page.tsx` with server-side session authentication (`requireCustomerPage`: signed-out visitors go to `/login`, staff to `/admin`).
- [x] Query Drizzle ORM for tickets where `userId === session.user.id`, ordered by `createdAt` descending (`listCustomerTickets` in `src/lib/tickets.ts`; ties broken by newest id; staff-only fields left out).
- [x] Display tickets in a responsive card/table layout with status badges, category pills, and priority indicators (shared in `src/components/tickets/ticket-badges.tsx` for tickets 11–13; dates shown in the viewer's timezone).
- [x] Provide an empty state ("No support tickets found") with a call-to-action button linking back to AI chat (`/`).
- [x] Include navigation links between Support Chat and "My Tickets" (in the site header, for customers only).

**Not covered:** filtering tickets by status (spec user story 10) is not on this checklist and still needs a ticket.
