# 06: Grounded AI Knowledge Base and Gemini Client

**What to build:** Build the AI customer support service using Google Gemini (`@google/genai`). Ground the model with structured company support policies, FAQs, escalation criteria, and define the `create_ticket` function tool declaration.

**Blocked by:** 01: Project Restructuring and Monorepo Cleanup

**Status:** ready-for-agent

- [ ] Install `@google/genai` (or official Google GenAI SDK).
- [ ] Create `src/lib/knowledge-base.ts` containing domain FAQs, order rules, payment policies, refund criteria, and escalation guidelines.
- [ ] Create `src/lib/gemini.ts` initializing the Gemini client with `process.env.GEMINI_API_KEY`.
- [ ] Define the `create_ticket` tool declaration with parameters: `subject`, `category` (enum), `priority` (enum), and `escalationReason`.
- [ ] Build conversation runner function accepting conversation history, system prompt, and tools.
