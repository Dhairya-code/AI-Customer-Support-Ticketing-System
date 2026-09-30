# 11: Customer Ticket Conversation Thread & Replies

**What to build:** Build the customer ticket detail view at `/tickets/[id]`. Customers can inspect the entire conversation history (including initial AI turns and agent replies), verify current status, and send new follow-up replies to the support team.

**Blocked by:** 10: Customer "My Tickets" Overview

**Status:** done

- [x] Create `src/app/(customer)/tickets/[id]/page.tsx` ensuring the ticket belongs to the authenticated customer (another customer's ticket, or an invalid id, is a 404).
- [x] Fetch all messages where `ticketId === params.id` and filter out internal notes (`isInternal !== true`) (`getCustomerTicketThread` in `src/lib/tickets.ts`).
- [x] Render chronological conversation messages, visually distinguishing customer, AI assistant, and human agent replies.
- [x] Add reply box allowing the customer to submit follow-up messages stored into the `messages` table with `senderType = "customer"` (`replyToTicket` Server Action → `addCustomerReply`; also bumps the ticket's `updatedAt`).
- [x] Disable message submission if the ticket status is marked `"closed"` (the reply box is replaced by a notice, and the server refuses the reply atomically).

**Notes for later tickets:** system messages are shown to customers (ticket 15 should word status events accordingly); replying to a `resolved` ticket does not reopen it.
