# 07: Interactive Customer AI Chat Interface

**What to build:** Build the customer chat interface on `/`. Authenticated customers can converse with the AI support assistant in real time, see message bubbles, loading indicators, and receive immediate AI responses for general questions.

**Blocked by:** 04: Customer Authentication Pages, 06: Grounded AI Knowledge Base and Gemini Client

**Status:** done

- [x] Create route handler `src/app/api/chat/route.ts` that receives chat turns, passes context to Gemini, and returns AI responses (customers only; request validated by `parseChatRequest` in `src/lib/chat.ts`; `create_ticket` is offered but its handler reports "unavailable" until ticket 08).
- [x] Build chat UI in `src/app/(customer)/page.tsx` featuring conversation history, user input form, disabled/loading states, and error handling (`src/components/chat/customer-chat.tsx`).
- [x] Ensure non-authenticated users visiting `/` are cleanly prompted or redirected to `/login` (`requireCustomerPage()`; staff go to `/admin`).
- [x] Test standard FAQ turns (e.g. asking for return policy or operating hours) and ensure the AI answers directly without raising a ticket (route tests with a faked Gemini; checked live against Gemini on 2026-09-30: both questions answered with no tool calls).
