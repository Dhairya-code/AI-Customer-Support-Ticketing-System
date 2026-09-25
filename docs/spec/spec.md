# Feature Specification: Fullstack AI Customer Support & Ticketing System

## Problem Statement

When customers encounter issues with products or services, they face high latency, frustrating static forms, and long waiting times before a human agent responds. Meanwhile, support teams are overwhelmed with repetitive Tier-1 questions (e.g., return policies, basic order inquiries, general troubleshooting), leaving them with less time to resolve urgent, complex, or financially sensitive problems.

From the customer's perspective:
- They want immediate, intelligent answers to routine questions 24/7 without waiting in an email queue.
- If their issue is genuinely complex, critical, or frustrating, they need a seamless handoff to human support without repeating their entire story.
- They need a transparent portal to track their past and active tickets, see agent replies, and continue the conversation.

From the support agent's perspective:
- They need an uncluttered dashboard that prioritizes critical inquiries (payments, refunds, system bugs) over trivial questions.
- They need the full transcript of what the customer discussed with the AI prior to escalation, so they have complete context immediately.
- They need to collaborate privately with teammates using internal notes without exposing internal operational discussions to the customer.

---

## Solution

A unified, fullstack AI-powered Customer Support & Ticketing platform built with Next.js, Neon Serverless PostgreSQL, Drizzle ORM, Better Auth, and TailwindCSS:
1. **Interactive AI First-Responder**: Customers engage in a conversational chat powered by Google Gemini, grounded in company policy and FAQ knowledge. Routine problems are resolved instantly in the chat window.
2. **Autonomous Tool-Based Escalation**: When the AI encounters critical problems (failed payments, refund demands, system errors) or when the customer requests human help, Gemini invokes a `create_ticket` function tool. This automatically records ticket metadata (category, priority, escalation reason) and links the conversation transcript.
3. **Customer Self-Service Hub**: Customers authenticate securely to track all their tickets, review status (`open`, `in_progress`, `resolved`, `closed`), and reply to agents.
4. **Discreet Agent & Admin Portal**: Staff members access `/admin/login` to inspect queues, filter tickets, post public replies, record private internal notes, and manage the full ticket lifecycle.
5. **Transactional Email Bridge**: Automated Resend emails keep both customers and agents notified upon ticket creation and replies.

---

## User Stories

### Customer Experience & Authentication
1. As a customer, I want to create an account with my email and password, so that all my support inquiries and tickets are securely tracked under my profile.
2. As a customer, I want to log into my account seamlessly, so that I can resume past chats and check ticket updates.
3. As a customer, I want to interact with an AI Assistant in real time on the homepage, so that I can get immediate answers to my queries without waiting for an agent.
4. As a customer, I want the AI Assistant to answer policy, shipping, and FAQ questions accurately, so that my problem is resolved on first contact.
5. As a customer, I want the AI Assistant to recognize when my issue is critical (such as payment deductions without confirmation), so that a ticket is opened without me having to fill out tedious forms.
6. As a customer, I want to ask for a human agent at any point during chat, so that the AI immediately escalates my problem.
7. As a customer, I want to receive an immediate ticket confirmation number in the chat window once escalated, so that I know my issue has been officially logged.
8. As a customer, I want to receive a confirmation email via Resend with my ticket ID and summary, so that I have a written record of my request.
9. As a customer, I want to navigate to a "My Tickets" page (`/tickets`), so that I can see an overview of all tickets I have ever created.
10. As a customer, I want to filter or view tickets by status (e.g., Open, In Progress, Resolved), so that I know which issues are pending and which are closed.
11. As a customer, I want to open any ticket (`/tickets/[id]`) to view the entire conversation history, including what I told the AI and what the human agent responded.
12. As a customer, I want to send follow-up replies on my ticket, so that I can provide additional information requested by the agent.
13. As a customer, I want to receive an email notification when a support agent posts a reply, so that I don't miss important updates.
14. As a customer, I want to see visual status badges for my tickets, so that I immediately know their priority and progress.

### Support Agent & Administrator Experience
15. As a support agent, I want to log in through a discreet `/admin/login` route, so that customer-facing navigation remains focused solely on customer needs.
16. As a support agent, I want my role (`agent` or `admin`) verified on every dashboard request, so that unauthorized customers cannot access support queues.
17. As a support agent, I want an admin dashboard overview showing key metrics (Total Tickets, Open Tickets, High/Critical Tickets, Resolved Tickets), so that I can gauge current support volume at a glance.
18. As a support agent, I want to filter tickets by status (`open`, `in_progress`, `resolved`, `closed`), so that I can focus on unresolved queues.
19. As a support agent, I want to filter tickets by category (`payment`, `order`, `delivery`, `account`, `technical`, `refund`, `other`), so that domain specialists can handle specific issues.
20. As a support agent, I want to filter tickets by priority (`critical`, `high`, `medium`, `low`), so that severe incidents are addressed immediately.
21. As a support agent, I want to view the full chat transcript that took place between the customer and the AI Assistant, so that the customer never has to repeat themselves.
22. As a support agent, I want to see the AI's escalation reason and confidence score, so that I understand why the ticket was created.
23. As a support agent, I want to post public replies to the customer, so that I can resolve their concern and answer their questions.
24. As a support agent, I want my public replies to trigger an email to the customer via Resend, so that the customer is notified even if they leave the website.
25. As a support agent, I want to post private internal notes on the ticket, so that I can document troubleshooting steps or consult colleagues without the customer seeing it.
26. As a support agent, I want internal notes clearly distinguished visually with a badge/color, so that our team doesn't confuse internal comments with customer replies.
27. As a support agent, I want to transition the status of a ticket from `open` to `in_progress` when I begin working on it, so that my teammates know it is being handled.
28. As a support agent, I want to transition a ticket to `resolved` once the problem is fixed, so that queue metrics remain accurate.
29. As a support agent, I want to assign or reassign tickets to specific agents, so that accountability is clear.
30. As an admin, I want to create and manage support agent accounts, so that our support team can scale.
31. As an admin, I want system settings and AI policy prompts to be easily configurable in code, so that company guidelines can be updated quickly.

---

## Implementation Decisions

### 1. Unified Fullstack Architecture
- Migrate from split FastAPI/SQLite + Next.js to a single Next.js App Router application in `src/`.
- Deprecate Python FastAPI backend, uvicorn, and SQLite `support.db`.
- Directory structure:
  - `src/app/(auth)/`: Login and registration routes.
  - `src/app/(customer)/`: Customer AI chat (`/`) and ticket tracking (`/tickets`, `/tickets/[id]`).
  - `src/app/admin/`: Discreet staff login (`/admin/login`), triage dashboard (`/admin`), and agent ticket view (`/admin/tickets/[id]`).
  - `src/app/api/`: Route handlers for Better Auth, Gemini AI chat with tools, and ticket actions.
  - `src/db/`: Neon PostgreSQL connection pool and Drizzle schema definitions.
  - `src/lib/`: Better Auth configuration, Gemini AI tool definitions, Resend email client, and knowledge base.

### 2. Database Schema (Drizzle ORM & Neon)
Tables defined in `src/db/schema.ts`:
- **`user`**: Better Auth core table with added `role` column (`"customer" | "agent" | "admin"`).
- **`session`**, **`account`**, **`verification`**: Better Auth managed tables.
- **`tickets`**:
  ```typescript
  // Decision Prototype Schema
  export const tickets = pgTable("tickets", {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    subject: varchar("subject", { length: 255 }).notNull(),
    category: varchar("category", { length: 50 }).notNull().default("other"),
    priority: varchar("priority", { length: 20 }).notNull().default("medium"),
    status: varchar("status", { length: 30 }).notNull().default("open"), // open, in_progress, resolved, closed
    escalationReason: text("escalation_reason"),
    assignedToId: text("assigned_to_id").references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  });
  ```
- **`messages`**:
  ```typescript
  // Decision Prototype Schema
  export const messages = pgTable("messages", {
    id: serial("id").primaryKey(),
    ticketId: integer("ticket_id").references(() => tickets.id, { onDelete: "cascade" }),
    senderId: text("sender_id").references(() => user.id),
    senderType: varchar("sender_type", { length: 20 }).notNull(), // customer, agent, ai, system
    content: text("content").notNull(),
    isInternal: boolean("is_internal").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  });
  ```

### 3. Authentication & Role Enforcement
- Using **Better Auth** (`better-auth`) with `@better-auth/drizzle-adapter`.
- Passwords hashed and managed by Better Auth.
- Role-based middleware/server-action guards:
  - Customer routes verify session exists.
  - Admin routes verify `session.user.role === 'agent' || session.user.role === 'admin'`.

### 4. AI Engine & Tool Escalation
- Google Gemini via `@google/genai` or official SDK using `gemini-2.5-flash` / `gemini-3.8-flash`.
- Chat session passes the recent message history along with system instructions from `src/lib/knowledge-base.ts`.
- Tool definition:
  ```typescript
  {
    name: "create_ticket",
    description: "Create a formal support ticket when an issue requires human assistance, payment resolution, refund approval, or user requests agent.",
    parameters: {
      type: "OBJECT",
      properties: {
        subject: { type: "STRING" },
        category: { type: "STRING", enum: ["payment", "order", "delivery", "account", "technical", "refund", "other"] },
        priority: { type: "STRING", enum: ["low", "medium", "high", "critical"] },
        escalationReason: { type: "STRING" }
      },
      required: ["subject", "category", "priority", "escalationReason"]
    }
  }
  ```
- When triggered, the server writes the ticket, copies conversation messages to `messages` referencing `ticketId`, sends a Resend email, and returns `{ ticketId, status: "created" }` to Gemini.

### 5. Email Dispatch (Resend)
- On ticket creation: sends acknowledgment email to customer containing ticket ID and summary, plus an alert to the support team queue.
- On agent reply: sends notification email to customer with agent message snippet and link to `/tickets/[id]`.

---

## Testing Decisions

### Seam Architecture
- **Primary Seam (API & Server Actions Level)**:
  - Tests will target the highest seam possible: Server Actions and Next.js Route Handlers (`/api/chat`, `/api/tickets`, Better Auth sign-in).
  - External behavior is verified: given an input message, does the chat respond with text or execute a tool call creating a valid database row?
- **Data Isolation & Role Verification Seam**:
  - Test role authorization: customer sessions accessing `/admin/*` must receive 401/403.
  - Test internal note privacy: customer fetching `/tickets/[id]` must never receive rows where `isInternal === true`.
- **Mocking Strategy**:
  - Gemini API and Resend API will be mocked at network boundary for automated unit/integration runs to prevent burning credits and flaky tests.

---

## Out of Scope

1. **Voice / Video Customer Support**: Voice calls, WebRTC, and phone support are deferred to future phases.
2. **Third-party Social Omnichannel**: WhatsApp, Telegram, or SMS gateways are not in this release (email + in-app web chat only).
3. **Multi-Tenant SaaS / Organization Billing**: Single organization deployment (all agents belong to one company).
4. **WebSocket Live Typing Indicators**: High-performance Server-Sent Events / streaming and Server Actions provide immediate updates without requiring stateful socket servers.

---

## Further Notes

- **Migration Path**: Frontend dependencies and codebase moved to root `src/` layout; legacy `backend/` and `frontend/` folders will be safely cleaned up.
- **Environment Configuration**: Documented in `.env.example` including Neon `DATABASE_URL`, `BETTER_AUTH_SECRET`, `GEMINI_API_KEY`, and `RESEND_API_KEY`.
- **Git Ignore**: The `docs/` folder is explicitly excluded in `.gitignore` to keep internal specs and architecture notes local as requested.
