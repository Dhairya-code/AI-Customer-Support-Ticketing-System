import {
  CREATE_TICKET_TOOL,
  getGeminiClient,
  runConversation,
} from "@/lib/gemini";
import { parseChatRequest } from "@/lib/chat";
import { SUPPORT_SYSTEM_INSTRUCTION } from "@/lib/knowledge-base";
import { AuthError, requireRole } from "@/lib/session";

const AI_UNAVAILABLE_MESSAGE =
  "Our assistant is having trouble responding right now. Please try again in a moment.";

export async function POST(request: Request): Promise<Response> {
  // Customers only: tickets escalated from chat are raised on their behalf.
  try {
    await requireRole(["customer"]);
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = parseChatRequest(body);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  let reply: string;
  try {
    const { text } = await runConversation({
      ai: getGeminiClient(),
      history: parsed.history,
      systemInstruction: SUPPORT_SYSTEM_INSTRUCTION,
      tools: [CREATE_TICKET_TOOL],
      // Ticket creation lands with ticket 08; until then the model is told the
      // tool failed, which the system instruction has it explain to the customer.
      onToolCall: async () => {
        throw new Error("Ticket creation is temporarily unavailable");
      },
    });
    reply = text.trim();
    // An empty answer (e.g. a blocked response) is no use to the customer.
    if (!reply) throw new Error("Gemini returned an empty reply");
  } catch (error) {
    // Details stay in the server log; the customer gets a generic message.
    console.error("Chat turn failed", error);
    return Response.json({ error: AI_UNAVAILABLE_MESSAGE }, { status: 502 });
  }

  return Response.json({ reply });
}
