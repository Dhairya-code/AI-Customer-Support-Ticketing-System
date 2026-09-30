import "server-only";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  messages,
  tickets,
  type Message,
  type NewMessage,
  type Ticket,
  type TicketStatus,
} from "@/db/schema";
import { MAX_MESSAGE_LENGTH } from "./chat";
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

// tickets.id is a Postgres serial (int4); larger ids make the query fail.
const MAX_TICKET_ID = 2_147_483_647;

// Ticket ids arrive from URLs and Server Action arguments, so they are
// checked before reaching a query. Returns null for anything not a valid id.
export function parseTicketId(value: unknown): number | null {
  const id =
    typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  return typeof id === "number" &&
    Number.isInteger(id) &&
    id > 0 &&
    id <= MAX_TICKET_ID
    ? id
    : null;
}

export type CustomerTicketSummary = Pick<
  Ticket,
  "id" | "subject" | "category" | "priority" | "status" | "createdAt"
>;

export const CLOSED_STATUS = "closed" satisfies TicketStatus;

// Closed tickets are locked; every other status still takes replies.
export function acceptsReplies(status: TicketStatus): boolean {
  return status !== CLOSED_STATUS;
}

function ownedBy(customerId: string, ticketId: number) {
  return and(eq(tickets.id, ticketId), eq(tickets.userId, customerId));
}

// The ticket fields a customer may see. Leaves out staff-only fields such as
// the escalation reason and assignee.
const customerTicketColumns = {
  id: tickets.id,
  subject: tickets.subject,
  category: tickets.category,
  priority: tickets.priority,
  status: tickets.status,
  createdAt: tickets.createdAt,
};

// The customer's "My Tickets" list, newest first.
export async function listCustomerTickets(
  customerId: string,
): Promise<CustomerTicketSummary[]> {
  return db
    .select(customerTicketColumns)
    .from(tickets)
    .where(eq(tickets.userId, customerId))
    // Tickets opened in the same instant still list newest first.
    .orderBy(desc(tickets.createdAt), desc(tickets.id));
}

export type CustomerThreadMessage = Pick<
  Message,
  "id" | "senderType" | "content" | "createdAt"
>;

export interface CustomerTicketThread {
  ticket: CustomerTicketSummary;
  messages: CustomerThreadMessage[];
}

// A ticket and its conversation as the customer may see them: null unless the
// ticket is theirs, and never including internal notes.
export async function getCustomerTicketThread(
  customerId: string,
  ticketId: number,
): Promise<CustomerTicketThread | null> {
  const [ticket] = await db
    .select(customerTicketColumns)
    .from(tickets)
    .where(ownedBy(customerId, ticketId));
  if (!ticket) return null;

  const thread = await db
    .select({
      id: messages.id,
      senderType: messages.senderType,
      content: messages.content,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(and(eq(messages.ticketId, ticketId), eq(messages.isInternal, false)))
    .orderBy(asc(messages.createdAt), asc(messages.id));

  return { ticket, messages: thread };
}

export interface CustomerReplyInput {
  customerId: string;
  ticketId: number;
  content: string;
}

export type CustomerReplyResult = { ok: true } | { ok: false; error: string };

// A customer's follow-up on their own ticket. Errors are shown to the
// customer as-is.
export async function addCustomerReply({
  customerId,
  ticketId,
  content,
}: CustomerReplyInput): Promise<CustomerReplyResult> {
  const text = content.trim();
  if (!text) return { ok: false, error: "Write a reply before sending." };
  if (text.length > MAX_MESSAGE_LENGTH) {
    return {
      ok: false,
      error: `Replies can be at most ${MAX_MESSAGE_LENGTH} characters.`,
    };
  }

  // neon-http has no transactions, so this single guarded update is where the
  // reply is accepted: a ticket closed a moment earlier can't slip one in.
  // Bumping updatedAt also surfaces the customer's activity to agents.
  const accepted = await db
    .update(tickets)
    .set({ updatedAt: new Date() })
    .where(
      and(
        ownedBy(customerId, ticketId),
        ne(tickets.status, CLOSED_STATUS),
      ),
    )
    .returning({ id: tickets.id });
  if (accepted.length === 0) {
    const [ticket] = await db
      .select({ id: tickets.id })
      .from(tickets)
      .where(ownedBy(customerId, ticketId));
    return {
      ok: false,
      error: ticket
        ? "This ticket is closed and no longer accepts replies."
        : "This ticket could not be found.",
    };
  }

  await db.insert(messages).values({
    ticketId,
    senderType: "customer",
    senderId: customerId,
    content: text,
  });
  return { ok: true };
}
