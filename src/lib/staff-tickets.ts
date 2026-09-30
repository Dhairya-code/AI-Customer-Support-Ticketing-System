import "server-only";
import { and, asc, count, desc, eq, inArray, ne, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  messages,
  tickets,
  user,
  type Message,
  type Ticket,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
} from "@/db/schema";
import { MAX_MESSAGE_LENGTH } from "./chat";
import { CLOSED_STATUS } from "./tickets";

// Staff views of tickets: the triage queue at /admin and the ticket page at
// /admin/tickets/[id]. Unlike the customer views, these span every customer
// and include internal notes.

export interface QueueFilters {
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
}

type SearchParams = Record<string, string | string[] | undefined>;

function parseEnumParam<T extends string>(
  allowed: readonly T[],
  raw: string | string[] | undefined,
): T | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (allowed as readonly string[]).includes(value ?? "")
    ? (value as T)
    : undefined;
}

// Filters arrive as URL search params, so anything unrecognised is dropped
// rather than reaching a query.
export function parseQueueFilters(params: SearchParams): QueueFilters {
  const filters: QueueFilters = {};
  const status = parseEnumParam(TICKET_STATUSES, params.status);
  const priority = parseEnumParam(TICKET_PRIORITIES, params.priority);
  const category = parseEnumParam(TICKET_CATEGORIES, params.category);
  if (status) filters.status = status;
  if (priority) filters.priority = priority;
  if (category) filters.category = category;
  return filters;
}

export interface QueueMetrics {
  total: number;
  open: number;
  highOrCritical: number;
  resolved: number;
}

const HIGH_OR_CRITICAL = ["high", "critical"] satisfies TicketPriority[];

function countWhere(condition: SQL) {
  return sql`count(*) filter (where ${condition})`.mapWith(Number);
}

// Counts across the whole queue, whatever filters the table has applied.
export async function getQueueMetrics(): Promise<QueueMetrics> {
  const [row] = await db
    .select({
      total: count(),
      open: countWhere(eq(tickets.status, "open")),
      highOrCritical: countWhere(inArray(tickets.priority, HIGH_OR_CRITICAL)),
      resolved: countWhere(eq(tickets.status, "resolved")),
    })
    .from(tickets);
  return row;
}

export type QueueTicket = Pick<
  Ticket,
  "id" | "subject" | "category" | "priority" | "status" | "createdAt"
> & {
  customerName: string;
  customerEmail: string;
};

// The queue table, newest first.
export async function listQueueTickets(
  filters: QueueFilters,
): Promise<QueueTicket[]> {
  const conditions: SQL[] = [];
  if (filters.status) conditions.push(eq(tickets.status, filters.status));
  if (filters.priority) conditions.push(eq(tickets.priority, filters.priority));
  if (filters.category) conditions.push(eq(tickets.category, filters.category));

  return db
    .select({
      id: tickets.id,
      subject: tickets.subject,
      category: tickets.category,
      priority: tickets.priority,
      status: tickets.status,
      createdAt: tickets.createdAt,
      customerName: user.name,
      customerEmail: user.email,
    })
    .from(tickets)
    .innerJoin(user, eq(tickets.userId, user.id))
    .where(and(...conditions))
    // Tickets opened in the same instant still list newest first.
    .orderBy(desc(tickets.createdAt), desc(tickets.id));
}

export type StaffTicket = Pick<
  Ticket,
  | "id"
  | "subject"
  | "category"
  | "priority"
  | "status"
  | "escalationReason"
  | "createdAt"
  | "updatedAt"
>;

export interface StaffTicketCustomer {
  id: string;
  name: string;
  email: string;
  // When they registered.
  createdAt: Date;
  // Tickets they opened before this one.
  previousTicketCount: number;
}

export type StaffThreadMessage = Pick<
  Message,
  "id" | "senderType" | "content" | "isInternal" | "createdAt"
> & {
  // Null for AI and system messages, or a sender whose account was deleted.
  senderName: string | null;
};

export interface StaffTicketDetail {
  ticket: StaffTicket;
  customer: StaffTicketCustomer;
  messages: StaffThreadMessage[];
}

// Everything the agent ticket page shows, or null if there is no such ticket.
export async function getStaffTicketDetail(
  ticketId: number,
): Promise<StaffTicketDetail | null> {
  const [row] = await db
    .select({
      ticket: {
        id: tickets.id,
        subject: tickets.subject,
        category: tickets.category,
        priority: tickets.priority,
        status: tickets.status,
        escalationReason: tickets.escalationReason,
        createdAt: tickets.createdAt,
        updatedAt: tickets.updatedAt,
      },
      customer: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
    })
    .from(tickets)
    .innerJoin(user, eq(tickets.userId, user.id))
    .where(eq(tickets.id, ticketId));
  if (!row) return null;

  const { ticket, customer } = row;
  // Compared in SQL: JS Dates drop the microseconds Postgres keeps. Ties on
  // createdAt fall back to id, as in the queue's ordering.
  const current = alias(tickets, "current");
  const openedBeforeThis = sql`(${tickets.createdAt}, ${tickets.id}) < ${db
    .select({ createdAt: current.createdAt, id: current.id })
    .from(current)
    .where(eq(current.id, ticketId))}`;
  const [[{ previousTicketCount }], thread] = await Promise.all([
    db
      .select({ previousTicketCount: count() })
      .from(tickets)
      .where(and(eq(tickets.userId, customer.id), openedBeforeThis)),
    db
      .select({
        id: messages.id,
        senderType: messages.senderType,
        content: messages.content,
        isInternal: messages.isInternal,
        createdAt: messages.createdAt,
        senderName: user.name,
      })
      .from(messages)
      .leftJoin(user, eq(messages.senderId, user.id))
      .where(eq(messages.ticketId, ticketId))
      .orderBy(asc(messages.createdAt), asc(messages.id)),
  ]);

  return {
    ticket,
    customer: { ...customer, previousTicketCount },
    messages: thread,
  };
}

// A public reply goes to the customer; an internal note is for staff only.
export const STAFF_MESSAGE_KINDS = ["reply", "note"] as const;
export type StaffMessageKind = (typeof STAFF_MESSAGE_KINDS)[number];

export interface StaffMessageInput {
  agentId: string;
  ticketId: number;
  content: string;
  kind: StaffMessageKind;
}

export type StaffMessageResult =
  // The ticket's customer, for the reply notification email.
  | { ok: true; customer: { name: string; email: string } }
  | { ok: false; error: string };

// An agent's public reply or internal note on any ticket. Errors are shown to
// the agent as-is.
export async function addStaffMessage({
  agentId,
  ticketId,
  content,
  kind,
}: StaffMessageInput): Promise<StaffMessageResult> {
  const text = content.trim();
  if (!text) return { ok: false, error: "Write a message before sending." };
  if (text.length > MAX_MESSAGE_LENGTH) {
    return {
      ok: false,
      error: `Messages can be at most ${MAX_MESSAGE_LENGTH} characters.`,
    };
  }

  // As with customer replies, this single guarded update is where the message
  // is accepted (neon-http has no transactions). A closed ticket is locked for
  // the customer, so it takes no public replies either, only notes.
  const isInternal = kind === "note";
  const [customer] = await db
    .update(tickets)
    .set({ updatedAt: new Date() })
    .from(user)
    .where(
      and(
        eq(tickets.id, ticketId),
        eq(tickets.userId, user.id),
        isInternal ? undefined : ne(tickets.status, CLOSED_STATUS),
      ),
    )
    .returning({ name: user.name, email: user.email });
  if (!customer) {
    const [ticket] = await db
      .select({ id: tickets.id })
      .from(tickets)
      .where(eq(tickets.id, ticketId));
    return {
      ok: false,
      error: ticket
        ? "This ticket is closed, so it takes internal notes only."
        : "This ticket could not be found.",
    };
  }

  await db.insert(messages).values({
    ticketId,
    senderType: "agent",
    senderId: agentId,
    content: text,
    isInternal,
  });
  return { ok: true, customer };
}
