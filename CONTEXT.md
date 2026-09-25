# Context: AI Customer Support & Ticketing System

## 1. Domain Vocabulary & Ubiquitous Language

- **Customer**: End-user seeking help or support. Authenticates with email and password via Better Auth. Can start chat sessions, view their own tickets at `/tickets`, and reply to agent responses.
- **Agent**: Support staff member responsible for reviewing escalated tickets, replying to customers, adding internal notes, and managing ticket lifecycles. Accesses dashboard via unlisted URL `/admin/login`.
- **Admin**: Elevated role managing agents, analytics, and system configurations.
- **Role**: Access level assigned to a user (`customer`, `agent`, `admin`).
- **Chat Session**: Active real-time interaction between a Customer and the AI Assistant on the customer portal. Persisted in the database.
- **Message**: Individual communication unit within a Chat Session or Ticket Thread. Can have `senderType`: `customer`, `ai`, `agent`, or `system`.
- **Internal Note**: A message created by an Agent on a ticket with `isInternal = true`. Visible exclusively to Agents and Admins, completely hidden from the Customer.
- **AI Assistant**: First-responder automated agent powered by Google Gemini (`@google/genai`). Configured with system instructions and company policies/FAQs to resolve standard inquiries.
- **Escalation & Tool Calling**: When the AI encounters a critical issue, customer dissatisfaction, or explicit request for a human, it invokes the `create_ticket` function tool.
- **Ticket**: Formal support request tracked in the system. Holds metadata (category, priority, status, assigned agent, escalation reason). Linked to customer and message history.
- **Ticket Status**:
  - `open`: Newly escalated ticket awaiting agent pickup.
  - `in_progress`: Agent is actively working on the ticket.
  - `resolved`: Issue addressed by agent; awaiting confirmation or auto-close.
  - `closed`: Ticket finalized and locked.
- **Ticket Priority**: `low` | `medium` | `high` | `critical`.
- **Ticket Category**: `payment` | `order` | `delivery` | `account` | `technical` | `refund` | `other`.
- **Email Notification**: Transactional email sent via Resend API on ticket creation (acknowledgment to customer, alert to agent team) and on agent replies.

---

## 2. System Architecture & Tech Stack

- **Framework**: Next.js 15/16 (App Router, React 19, Server Actions, Route Handlers) with `src/` directory convention.
- **Styling**: TailwindCSS (v4).
- **Database**: PostgreSQL hosted on Neon (Serverless).
- **ORM & Migrations**: Drizzle ORM (`drizzle-orm/neon-http`, `drizzle-kit`, `@neondatabase/serverless`).
- **Authentication**: Better Auth (`better-auth`) with Drizzle adapter.
  - Standard user login & registration: `/login`, `/register`.
  - Discreet staff login: `/admin/login`.
  - Roles: `customer`, `agent`, `admin`.
- **AI Engine**: Google Gemini (`@google/genai`) using function calling / tool use (`create_ticket`). Grounded with structured company policies and FAQs.
- **Email Service**: Resend (`resend`) for transactional support emails.

---

## 3. Directory Layout (`src/` Convention)

```
/
├── CONTEXT.md
├── docs/
│   └── adr/
│       ├── 0001-fullstack-nextjs-migration.md
│       └── 0002-data-model-and-ai-escalation.md
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (customer)/
│   │   │   ├── page.tsx               ← AI Support Chat
│   │   │   └── tickets/
│   │   │       ├── page.tsx           ← Customer "My Tickets"
│   │   │       └── [id]/page.tsx      ← Ticket Thread & Chat History
│   │   ├── admin/
│   │   │   ├── login/page.tsx         ← Discreet Staff Login
│   │   │   ├── page.tsx               ← Agent Dashboard & Metrics
│   │   │   └── tickets/
│   │   │       └── [id]/page.tsx      ← Agent Ticket View, Notes & Replies
│   │   ├── api/
│   │   │   ├── auth/[...all]/route.ts ← Better Auth Handler
│   │   │   ├── chat/route.ts          ← AI Chat Endpoint (Gemini + Tools)
│   │   │   └── tickets/route.ts
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/                    ← Reusable UI (Chat, Navbar, Badges, Modals)
│   ├── db/
│   │   ├── index.ts                   ← Drizzle client (Neon HTTP)
│   │   └── schema.ts                  ← Users, Sessions, Tickets, Messages
│   ├── lib/
│   │   ├── auth.ts                    ← Better Auth configuration
│   │   ├── auth-client.ts             ← Better Auth React client
│   │   ├── gemini.ts                  ← Gemini AI client & tool handlers
│   │   ├── email.ts                   ← Resend email templates & dispatcher
│   │   └── knowledge-base.ts          ← Configurable system prompt & FAQs
│   └── types/
├── drizzle.config.ts
├── package.json
└── tsconfig.json
```

---

## 4. Core Workflows

1. **AI Chat & First-Contact Resolution**:
   - Customer opens chat on `/`.
   - AI evaluates query against structured support guidelines & knowledge base.
   - If resolvable, AI answers directly with immediate guidance.
2. **AI Escalation & Function Calling**:
   - When query requires human intervention (e.g. payment failed, refund approval, or user requests human):
   - Gemini triggers tool call: `create_ticket({ subject, category, priority, escalationReason })`.
   - Backend executes tool:
     - Persists new `Ticket` linked to customer.
     - Saves chat messages into ticket history.
     - Dispatches Resend email acknowledgment to customer & agent alert.
     - Returns ticket ID to AI, which informs the user with ticket badge / link.
3. **Customer Ticket Tracking**:
   - Customer views list of their tickets on `/tickets` with status badges (`open`, `in_progress`, `resolved`, `closed`).
   - Customer can click into `/tickets/[id]` to review messages and send follow-up replies.
4. **Agent Management & Threaded Conversation**:
   - Agent logs in at `/admin/login`.
   - Filters tickets by status, category, and priority.
   - Opens ticket `/admin/tickets/[id]`.
   - Submits public replies (triggers email to customer via Resend + appears on customer `/tickets/[id]`) or internal notes (only visible to team).
   - Updates ticket status (`open` ➔ `in_progress` ➔ `resolved` ➔ `closed`).
