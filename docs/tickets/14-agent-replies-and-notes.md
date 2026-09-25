# 14: Agent Public Replies and Internal Team Notes

**What to build:** Build the agent messaging interface on `/admin/tickets/[id]`. Agents can submit public replies that appear in the customer's portal and trigger a Resend email notification, or submit private internal notes (`isInternal = true`) that remain visible only to support staff.

**Blocked by:** 09: Transactional Email Notifications with Resend, 13: Agent Ticket Detail View and Conversation Transcript

**Status:** ready-for-agent

- [ ] Create tabs or toggle in the reply box for "Public Reply" vs "Internal Note".
- [ ] Submitting a Public Reply saves a row in `messages` with `senderType = "agent"`, `isInternal = false`, and invokes `sendAgentReplyNotificationEmail`.
- [ ] Submitting an Internal Note saves a row in `messages` with `senderType = "agent"` and `isInternal = true`, bypassing email delivery.
- [ ] Visually style internal notes with a distinct background (e.g. amber/yellow tint) and a prominent "Internal Note - Only Staff Can See" badge.
- [ ] Ensure public replies appear immediately on the customer ticket page upon page reload or revalidation.
