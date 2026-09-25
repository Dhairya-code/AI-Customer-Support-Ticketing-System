# ADR 0002: Data Model, AI Tool-Call Escalation, and Threaded Communication

## Status
Accepted

## Context
Following the fullstack Next.js migration decision (ADR 0001), we required clear architectural patterns for:
1. Grounding the AI assistant with policy rules and domain knowledge.
2. The trigger mechanism for escalating customer inquiries into formal tickets.
3. Managing ticket conversation threads between Customer, AI, and Support Agents.
4. Internal collaboration among agents (private notes vs customer-facing replies).

## Decisions

### 1. Grounding & Knowledge Base
- The AI Assistant will be initialized with a structured System Instruction set (`src/lib/knowledge-base.ts`) covering:
  - Scope of support (order tracking, cancellation policy, returns & refunds, technical troubleshooting).
  - Escalation criteria (payment disputes, account security breaches, user insistence on human agent, unsolvable technical bugs).
  - Tone & safety constraints.

### 2. Escalation via Gemini Function Calling
- Rather than a separate post-chat classification pipeline, Gemini will be equipped with a function declaration:
  ```typescript
  create_ticket({
    subject: string,
    category: "payment" | "order" | "delivery" | "account" | "technical" | "refund" | "other",
    priority: "low" | "medium" | "high" | "critical",
    escalationReason: string
  })
  ```
- When invoked by the model during a chat turn:
  1. The server creates a `tickets` record in Neon Postgres via Drizzle ORM.
  2. The current conversation transcript is linked to this ticket.
  3. Resend triggers an email acknowledgment to the customer with ticket details and sends an email notification to the agent queue.
  4. The model receives the tool result (including `ticketId`) and generates a warm, helpful confirmation to the user.

### 3. Threaded Message Model with Internal Notes
- All messages in a ticket reside in a single `messages` table:
  - `ticketId`: References `tickets.id`.
  - `senderId`: References `users.id` (null for AI/System).
  - `senderType`: `customer` | `agent` | `ai` | `system`.
  - `content`: Message text.
  - `isInternal`: Boolean flag.
- When `isInternal = true`:
  - Only visible on `/admin/tickets/[id]`.
  - Hidden from Customer `/tickets/[id]`.
  - No email dispatch to customer.

### 4. Resend Transactional Email Strategy
- Free tier of Resend (`resend` SDK) used for:
  - Customer ticket receipt email on escalation.
  - Customer update email whenever an agent sends a public reply.
  - Agent alert on new critical/high tickets.

## Consequences
- Single unified schema in Drizzle handles auth, tickets, and multi-actor chat messages.
- AI escalation is seamless within the conversation flow without requiring manual user forms.
- Agents can collaborate with internal notes without polluting customer view.
