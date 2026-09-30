# ResolveAI

AI-first customer support and ticketing. Customers chat with an AI assistant
(Google Gemini) that answers routine questions straight away and, when a human
is needed, opens a support ticket for them. Support staff triage those tickets
from a dashboard, reply to customers, leave internal notes and move tickets
through their lifecycle.

## Tech stack

- Next.js 16 (App Router, Server Actions) with React 19 and Tailwind CSS v4
- PostgreSQL on Neon, via Drizzle ORM
- Better Auth (email and password) with `customer`, `agent` and `admin` roles
- Google Gemini (`@google/genai`) with a `create_ticket` tool for escalation
- Resend for transactional email
- Vitest for tests

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure the environment

Copy `.env.example` to `.env` and fill it in:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Random secret of at least 32 characters |
| `BETTER_AUTH_URL` | The app's URL, `http://localhost:3000` in development |
| `NEXT_PUBLIC_APP_URL` | Base URL for links in emails, usually the same as `BETTER_AUTH_URL` |
| `GEMINI_API_KEY` | Google Gemini API key (`GEMINI_MODEL` is optional) |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Resend key and sender address (optional; without them emails are skipped and logged) |
| `SUPPORT_TEAM_EMAIL` | Inbox that receives new-ticket alerts (optional) |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | The staff account created by `npm run db:seed` |

To run without email, leave `RESEND_API_KEY`, `RESEND_FROM_EMAIL` and
`SUPPORT_TEAM_EMAIL` empty: the placeholder values from `.env.example` are sent
to Resend and rejected.

The app must be opened at the URL set in `BETTER_AUTH_URL`, because Better
Auth rejects sign-ins from other origins.

### 3. Set up the database

```bash
npm run db:migrate
```

```bash
npm run db:seed
```

The seed script creates the admin account from `SEED_ADMIN_EMAIL` and
`SEED_ADMIN_PASSWORD`. Staff accounts are never created through the public
sign-up form.

### 4. Run the app

```bash
npm run dev
```

Open <http://localhost:3000>.

| URL | Who | What |
| --- | --- | --- |
| `/register`, `/login` | Customers | Create an account, sign in |
| `/` | Customers | Chat with the AI assistant |
| `/tickets`, `/tickets/[id]` | Customers | Track tickets and reply to support |
| `/admin/login` | Staff | Staff sign-in (unlisted) |
| `/admin`, `/admin/tickets/[id]` | Staff | Ticket queue, metrics and ticket management |

## Automated checks

```bash
npm run typecheck
```

```bash
npm test
```

```bash
npm run lint
```

The tests run against an in-memory PostgreSQL (PGlite), so they need no
database, API keys or network access.

## Manual testing guide

This walks the whole customer and agent journey. Use a normal browser window
for the customer and a private window for staff, so both can stay signed in at
once.

### Customer: sign up and session

1. Open <http://localhost:3000/register> and create an account.
2. You land on the support chat, with your name in the header.
3. Reload the page. You are still signed in.
4. Sign out, then sign back in at `/login`.

### Customer: AI answers a routine question

5. In the chat, ask a knowledge-base question, for example *"How long does
   standard delivery take?"*
6. The assistant answers directly, and no ticket is created (`/tickets` stays
   empty).

### Customer: escalation to a ticket

7. Send a message that needs a human, for example *"My card was charged twice
   for order 48213. I need a human agent."*
8. The assistant replies that it created a ticket and shows a **Ticket
   Created #N** card with a **View ticket** link. The chat is then handed off.
9. Without Resend configured, the server log shows that the customer receipt
   and the team alert were skipped. With Resend configured, both emails
   arrive.
10. Open **My tickets**. The new ticket is listed with status **Open**, plus its
    category and priority.

### Agent: triage

11. In the private window, sign in at <http://localhost:3000/admin/login> with
    the seeded admin account.
12. The dashboard metrics include the new ticket, and it appears in the queue.
    Try the Status, Priority and Category filters.
13. Open the ticket. The full chat transcript and the escalation reason are
    shown.

### Agent: public reply and internal note

14. With **Public Reply** selected, send a reply. It appears in the thread, and
    the server log shows the "New reply on your ticket" email (or the email
    arrives, with Resend configured).
15. Switch to **Internal Note** and add a note. It appears with amber styling
    and an "Internal note" label.
16. In the customer window, open the ticket. The public reply is shown as
    **Support agent**, and the internal note does not appear.
17. Send a follow-up reply as the customer. It appears in the thread and on the
    agent's view.

### Agent: ticket lifecycle

18. Click **Mark In Progress**, then **Resolve Ticket**. Each change adds a
    message such as "Ticket marked as Resolved by Admin", and the dashboard's
    Open and Resolved counts update.
19. As the customer, a **resolved** ticket still accepts replies, so the
    customer can confirm the fix or say it isn't fixed.
20. Click **Close Ticket**. Closed is final: the status can no longer change,
    and staff can only add internal notes.
21. As the customer, the closed ticket shows "This ticket is closed" in place
    of the reply box.
22. Priority, category and assignee can still be changed from the ticket's
    side panel.

### Access control

23. While signed in as a customer, open `/admin`. You are sent to the staff
    sign-in page.
24. Try to sign in at `/admin/login` with a customer account. It is refused.
25. Change the id in `/tickets/[id]` to a ticket you don't own. You get a 404.

### Responsive layout

26. Repeat a few steps at phone width (about 375px, for example in the
    browser's device toolbar). Pages should not scroll sideways, and the
    ticket queue table scrolls inside its own card.

## Project docs

- `CONTEXT.md`: domain vocabulary and architecture
- `docs/adr/`: architecture decisions
- `docs/spec/`, `docs/tickets/`: the specification and the implementation
  tickets
