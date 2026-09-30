import { after } from "next/server";
import type { SessionUser } from "@/lib/auth";
import { parseChatRequest, type ChatResponse } from "@/lib/chat";
import { sendAgentAlertEmail, sendTicketCreatedEmail } from "@/lib/email";
import {
  CREATE_TICKET_TOOL,
  getGeminiClient,
  parseCreateTicketArgs,
  runConversation,
  type CreateTicketArgs,
  type ToolCall,
  type ToolResult,
} from "@/lib/gemini";
import { SUPPORT_SYSTEM_INSTRUCTION } from "@/lib/knowledge-base";
import { AuthError, requireRole } from "@/lib/session";
import { appendAiReply, createTicketFromChat } from "@/lib/tickets";

const AI_UNAVAILABLE_MESSAGE =
  "Our assistant is having trouble responding right now. Please try again in a moment.";

// Sent after the response so email never delays the customer's reply. The
// helpers log their own failures and never throw.
function notifyTicketCreated(
  customer: SessionUser,
  ticketId: number,
  { subject, category, priority, escalationReason }: CreateTicketArgs,
): void {
  after(() =>
    Promise.all([
      sendTicketCreatedEmail({
        to: customer.email,
        customerName: customer.name,
        ticketId,
        subject,
        reason: escalationReason,
      }),
      sendAgentAlertEmail({ ticketId, subject, priority, category }),
    ]),
  );
}

export async function POST(request: Request): Promise<Response> {
  // Customers only: tickets escalated from chat are raised on their behalf.
  let customer: SessionUser;
  try {
    customer = await requireRole(["customer"]);
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
  const { transcript, history } = parsed;

  let ticketId: number | undefined;

  // Errors thrown here are relayed to the model, which tells the customer, so
  // their messages must be customer-safe.
  async function handleToolCall({ name, args }: ToolCall): Promise<ToolResult> {
    if (name !== CREATE_TICKET_TOOL.name) {
      throw new Error(`Unknown tool "${name}"`);
    }
    // A repeat call in the same turn gets the existing ticket, not a duplicate.
    if (ticketId === undefined) {
      const details = parseCreateTicketArgs(args);
      try {
        ({ ticketId } = await createTicketFromChat({
          customerId: customer.id,
          details,
          transcript,
        }));
      } catch (error) {
        console.error("Ticket creation failed", error);
        throw new Error("The ticket could not be saved");
      }
      notifyTicketCreated(customer, ticketId, details);
    }
    return { ticketId, status: "created" };
  }

  let reply: string;
  try {
    const { text } = await runConversation({
      ai: getGeminiClient(),
      history,
      systemInstruction: SUPPORT_SYSTEM_INSTRUCTION,
      tools: [CREATE_TICKET_TOOL],
      onToolCall: handleToolCall,
    });
    reply = text.trim();
    // An empty answer (e.g. a blocked response) is no use to the customer.
    if (!reply) throw new Error("Gemini returned an empty reply");
  } catch (error) {
    // Details stay in the server log; the customer gets a generic message.
    console.error("Chat turn failed", error);
    if (ticketId === undefined) {
      return Response.json({ error: AI_UNAVAILABLE_MESSAGE }, { status: 502 });
    }
    // The ticket exists, so confirm it: an error would invite a retry that
    // opens a duplicate.
    reply = `I've opened support ticket #${ticketId} for you. A member of our support team will follow up with you.`;
  }

  if (ticketId === undefined) {
    return Response.json({ reply } satisfies ChatResponse);
  }

  try {
    await appendAiReply(ticketId, reply);
  } catch (error) {
    // The ticket and transcript are saved; losing the confirmation line is
    // not worth failing the customer's turn over.
    console.error("Saving the escalation reply failed", error);
  }
  return Response.json({ reply, ticket: { id: ticketId } } satisfies ChatResponse);
}
