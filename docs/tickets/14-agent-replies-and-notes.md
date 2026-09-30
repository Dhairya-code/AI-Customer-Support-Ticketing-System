# 14: Agent Public Replies and Internal Team Notes

**What to build:** Build the agent messaging interface on `/admin/tickets/[id]`. Agents can submit public replies that appear in the customer's portal and trigger a Resend email notification, or submit private internal notes (`isInternal = true`) that remain visible only to support staff.

**Blocked by:** 09: Transactional Email Notifications with Resend, 13: Agent Ticket Detail View and Conversation Transcript

**Status:** done

- [x] Create tabs or toggle in the reply box for "Public Reply" vs "Internal Note" (`StaffReplyForm` in `src/app/admin/tickets/[id]/staff-reply-form.tsx`).
- [x] Submitting a Public Reply saves a row in `messages` with `senderType = "agent"`, `isInternal = false`, and invokes `sendAgentReplyNotificationEmail` (`postStaffMessage` Server Action → `addStaffMessage` in `src/lib/staff-tickets.ts`; the email is sent via `after()`).
- [x] Submitting an Internal Note saves a row in `messages` with `senderType = "agent"` and `isInternal = true`, bypassing email delivery.
- [x] Visually style internal notes with a distinct background (e.g. amber/yellow tint) and a prominent "Internal Note - Only Staff Can See" badge.
- [x] Ensure public replies appear immediately on the customer ticket page upon page reload or revalidation (the customer page reads fresh on every request; the agent page calls `refresh()`).

**Notes for later tickets:** closed tickets refuse public replies (matching the customer-side lock) but still take internal notes. Every staff message bumps the ticket's `updatedAt`. Agent replies do not change the ticket's status; ticket 15 may want to move `open` tickets to `in_progress` on a first reply.
