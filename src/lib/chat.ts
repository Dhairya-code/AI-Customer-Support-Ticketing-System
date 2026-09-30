import type { ChatTurn } from "./gemini";

// Shared by the chat route and the chat UI, so it must stay client-safe.

export const MAX_MESSAGE_LENGTH = 4000;

// Only the most recent turns go to Gemini, bounding the cost of long chats.
const MAX_HISTORY_TURNS = 20;

export type ChatRequestResult =
  | { ok: true; history: ChatTurn[] }
  | { ok: false; error: string };

// The request body is untrusted: the client owns the transcript until ticket
// escalation persists it, so every turn is checked before reaching Gemini.
export function parseChatRequest(body: unknown): ChatRequestResult {
  const messages = (body as { messages?: unknown } | null)?.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return { ok: false, error: "Send at least one message." };
  }

  const history: ChatTurn[] = [];
  for (const message of messages) {
    const { role, text } = (message ?? {}) as Record<string, unknown>;
    if (role !== "user" && role !== "model") {
      return { ok: false, error: "Each message needs a valid role." };
    }
    if (typeof text !== "string" || !text.trim()) {
      return { ok: false, error: "Messages cannot be empty." };
    }
    if (text.length > MAX_MESSAGE_LENGTH) {
      return {
        ok: false,
        error: `Messages must be ${MAX_MESSAGE_LENGTH} characters or fewer.`,
      };
    }
    history.push({ role, text: text.trim() });
  }

  if (history.at(-1)?.role !== "user") {
    return { ok: false, error: "The last message must be from the customer." };
  }

  // Gemini expects a conversation to open with a user turn, so a trimmed
  // history that would start mid-exchange drops its leading model turns.
  const recent = history.slice(-MAX_HISTORY_TURNS);
  const firstUserTurn = recent.findIndex((turn) => turn.role === "user");
  return { ok: true, history: recent.slice(firstUserTurn) };
}
