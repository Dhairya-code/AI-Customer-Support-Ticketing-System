# 11: Customer Ticket Conversation Thread & Replies

**What to build:** Build the customer ticket detail view at `/tickets/[id]`. Customers can inspect the entire conversation history (including initial AI turns and agent replies), verify current status, and send new follow-up replies to the support team.

**Blocked by:** 10: Customer "My Tickets" Overview

**Status:** ready-for-agent

- [ ] Create `src/app/(customer)/tickets/[id]/page.tsx` ensuring the ticket belongs to the authenticated customer.
- [ ] Fetch all messages where `ticketId === params.id` and filter out internal notes (`isInternal !== true`).
- [ ] Render chronological conversation messages, visually distinguishing customer, AI assistant, and human agent replies.
- [ ] Add reply box allowing the customer to submit follow-up messages stored into the `messages` table with `senderType = "customer"`.
- [ ] Disable message submission if the ticket status is marked `"closed"`.
