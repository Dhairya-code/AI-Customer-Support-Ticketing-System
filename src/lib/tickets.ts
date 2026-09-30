import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { messages, tickets, type NewMessage, type Ticket } from "@/db/schema";
import type { ChatTurn, CreateTicketArgs } from "./gemini";

export interface CreateTicketFromChatInput {
  customerId: string;
  details: CreateTicketArgs;
  // The chat so far, oldest first; copied into the ticket's thread.
  transcript: ChatTurn[];
}

function toThreadMessage(
  ticketId: number,
  customerId: string,
  turn: ChatTurn,
): NewMessage {
  const fromCustomer = turn.role === "user";
  return {
    ticketId,
    senderType: fromCustomer ? "customer" : "ai",
    senderId: fromCustomer ? customerId : null,
    content: turn.text,
  };
}

// Opens a ticket for an AI escalation and links the chat transcript to it.
export async function createTicketFromChat({
  customerId,
  details,
  transcript,
}: CreateTicketFromChatInput): Promise<{ ticketId: number }> {
  const [ticket] = await db
    .insert(tickets)
    .values({ userId: customerId, status: "open", ...details })
    .returning({ id: tickets.id });

  // neon-http has no interactive transactions, so a failed transcript write
  // removes the ticket rather than leaving one with no conversation.
  try {
    await db
      .insert(messages)
      .values(transcript.map((turn) => toThreadMessage(ticket.id, customerId, turn)));
  } catch (error) {
    await db.delete(tickets).where(eq(tickets.id, ticket.id));
    throw error;
  }

  return { ticketId: ticket.id };
}

// Adds the AI's reply from the escalating turn, so the thread ends with the
// confirmation the customer saw.
export async function appendAiReply(ticketId: number, text: string): Promise<void> {
  await db.insert(messages).values({ ticketId, senderType: "ai", content: text });
}

export type CustomerTicketSummary = Pick<
  Ticket,
  "id" | "subject" | "category" | "priority" | "status" | "createdAt"
>;

// The customer's "My Tickets" list, newest first. Leaves out staff-only
// fields such as the escalation reason and assignee.
export async function listCustomerTickets(
  customerId: string,
): Promise<CustomerTicketSummary[]> {
  return db
    .select({
      id: tickets.id,
      subject: tickets.subject,
      category: tickets.category,
      priority: tickets.priority,
      status: tickets.status,
      createdAt: tickets.createdAt,
    })
    .from(tickets)
    .where(eq(tickets.userId, customerId))
    // Tickets opened in the same instant still list newest first.
    .orderBy(desc(tickets.createdAt), desc(tickets.id));
}
