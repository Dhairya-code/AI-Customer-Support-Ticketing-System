# 08: Autonomous AI Ticket Escalation via Tool Calling

**What to build:** Implement execution logic for Gemini's `create_ticket` tool call. When triggered by a critical issue or customer request for human support, the backend creates a `tickets` record in Neon Postgres, copies the conversation into the `messages` table, and returns a confirmation ticket ID to the customer in chat.

**Blocked by:** 02: Neon Database and Drizzle ORM Schema Setup, 06: Grounded AI Knowledge Base and Gemini Client, 07: Interactive Customer AI Chat Interface

**Status:** done

- [x] In `src/app/api/chat/route.ts`, intercept tool calls from Gemini when `name === "create_ticket"` (arguments validated with `parseCreateTicketArgs`; a repeat call in the same turn reuses the ticket).
- [x] Insert a new row into `tickets` table with `userId`, `subject`, `category`, `priority`, `escalationReason`, and status `"open"` (`createTicketFromChat` in `src/lib/tickets.ts`).
- [x] Persist all previous chat turns into the `messages` table linked to the newly created `ticketId` (the full transcript, not just the turns sent to Gemini, plus the AI's confirmation reply).
- [x] Return tool execution output containing `ticketId` to Gemini (`{ ticketId, status: "created" }`; if Gemini then fails, the route still confirms the ticket rather than returning an error).
- [x] Render a stylized "Ticket Created #ID" banner in the chat UI with a direct link to view the ticket (links to `/tickets/[id]`, built in tickets 10/11; the chat ends after escalation, with a "Start a new chat" option).

**Known limitation:** the transcript is sent by the client, so a customer could forge turns that get saved as `senderType: "ai"`. Fixing this needs server-owned chat history (or signed AI replies).
