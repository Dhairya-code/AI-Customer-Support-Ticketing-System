# 08: Autonomous AI Ticket Escalation via Tool Calling

**What to build:** Implement execution logic for Gemini's `create_ticket` tool call. When triggered by a critical issue or customer request for human support, the backend creates a `tickets` record in Neon Postgres, copies the conversation into the `messages` table, and returns a confirmation ticket ID to the customer in chat.

**Blocked by:** 02: Neon Database and Drizzle ORM Schema Setup, 06: Grounded AI Knowledge Base and Gemini Client, 07: Interactive Customer AI Chat Interface

**Status:** ready-for-agent

- [ ] In `src/app/api/chat/route.ts`, intercept tool calls from Gemini when `name === "create_ticket"`.
- [ ] Insert a new row into `tickets` table with `userId`, `subject`, `category`, `priority`, `escalationReason`, and status `"open"`.
- [ ] Persist all previous chat turns into the `messages` table linked to the newly created `ticketId`.
- [ ] Return tool execution output containing `ticketId` to Gemini.
- [ ] Render a stylized "Ticket Created #ID" banner in the chat UI with a direct link to view the ticket.
