# 06: Grounded AI Knowledge Base and Gemini Client

**What to build:** Build the AI customer support service using Google Gemini (`@google/genai`). Ground the model with structured company support policies, FAQs, escalation criteria, and define the `create_ticket` function tool declaration.

**Blocked by:** 01: Project Restructuring and Monorepo Cleanup

**Status:** done

- [x] Install `@google/genai` (or official Google GenAI SDK).
- [x] Create `src/lib/knowledge-base.ts` containing domain FAQs, order rules, payment policies, refund criteria, and escalation guidelines (plus technical troubleshooting steps; exported as `SUPPORT_SYSTEM_INSTRUCTION`).
- [x] Create `src/lib/gemini.ts` initializing the Gemini client with `process.env.GEMINI_API_KEY` (lazy `getGeminiClient()`; model `gemini-3.8-flash`, free tier, overridable via `GEMINI_MODEL`).
- [x] Define the `create_ticket` tool declaration with parameters: `subject`, `category` (enum), `priority` (enum), and `escalationReason` (`CREATE_TICKET_TOOL`, with `parseCreateTicketArgs` to validate the model's arguments for ticket 08).
- [x] Build conversation runner function accepting conversation history, system prompt, and tools (`runConversation`; tool handler errors are returned to the model rather than thrown).
