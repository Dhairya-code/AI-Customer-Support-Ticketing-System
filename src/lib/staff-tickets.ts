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
  type UserRole,
} from "@/db/schema";
import { MAX_MESSAGE_LENGTH } from "./chat";
import { STAFF_ROLES } from "./staff-auth";
import { statusLabel } from "./ticket-labels";
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

// For values from URLs and Server Action arguments.
export function isOneOf<T extends string>(
  allowed: readonly T[],
  value: unknown,
): value is T {
  return (allowed as readonly unknown[]).includes(value);
}

function parseEnumParam<T extends string>(
  allowed: readonly T[],
  raw: string | string[] | undefined,
): T | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return isOneOf(allowed, value)
    ? value
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
  | "assignedToId"
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
        assignedToId: tickets.assignedToId,
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

// The outcome of a staff change; errors are shown to the agent as-is.
export type StaffActionResult = { ok: true } | { ok: false; error: string };

const TICKET_NOT_FOUND = "This ticket could not be found.";

async function ticketExists(ticketId: number): Promise<boolean> {
  const [ticket] = await db
    .select({ id: tickets.id })
    .from(tickets)
    .where(eq(tickets.id, ticketId));
  return Boolean(ticket);
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
  | Extract<StaffActionResult, { ok: false }>;

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
    return {
      ok: false,
      error: (await ticketExists(ticketId))
        ? "This ticket is closed, so it takes internal notes only."
        : TICKET_NOT_FOUND,
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

export interface StaffMember {
  id: string;
  name: string;
  role: UserRole;
}

// Everyone a ticket can be assigned to, by name.
export async function listStaffMembers(): Promise<StaffMember[]> {
  const rows = await db
    .select({ id: user.id, name: user.name, role: user.role })
    .from(user)
    .where(inArray(user.role, STAFF_ROLES))
    .orderBy(asc(user.name), asc(user.id));
  // role is nullable in the schema, but the filter only keeps staff roles.
  return rows as StaffMember[];
}

export interface TicketStatusChange {
  // Named in the system message the change leaves in the thread.
  agent: { id: string; name: string };
  ticketId: number;
  status: TicketStatus;
}

// Moves a ticket between open, in progress and resolved, in any direction, or
// closes it, and notes the change in the thread, where the customer sees it
// too. Closing is final (CONTEXT.md: "finalized and locked"). Setting the
// status a ticket already has changes nothing.
export async function setTicketStatus({
  agent,
  ticketId,
  status,
}: TicketStatusChange): Promise<StaffActionResult> {
  // Guarded on the old status, so two agents making the same change at once
  // leave one system message between them, and a ticket closed a moment
  // earlier stays closed.
  const changed = await db
    .update(tickets)
    .set({ status })
    .where(
      and(
        eq(tickets.id, ticketId),
        ne(tickets.status, status),
        ne(tickets.status, CLOSED_STATUS),
      ),
    )
    .returning({ id: tickets.id });
  if (changed.length === 0) {
    const [ticket] = await db
      .select({ status: tickets.status })
      .from(tickets)
      .where(eq(tickets.id, ticketId));
    if (!ticket) return { ok: false, error: TICKET_NOT_FOUND };
    return ticket.status === status
      ? { ok: true }
      : { ok: false, error: "This ticket is closed, so its status can't change." };
  }

  // neon-http has no transactions, so this is a second write: should it fail,
  // the status has still changed, just without its note in the thread.
  await db.insert(messages).values({
    ticketId,
    senderType: "system",
    content: `Ticket marked as ${statusLabel(status)} by ${agent.name}`,
  });
  return { ok: true };
}

export interface TicketTriage {
  priority?: TicketPriority;
  category?: TicketCategory;
  // Null unassigns the ticket.
  assignedToId?: string | null;
}

// Triage changes arrive as Server Action arguments, so anything malformed,
// unknown or empty is rejected as a whole rather than partly applied.
export function parseTicketTriage(raw: unknown): TicketTriage | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const entries = Object.entries(raw);
  if (entries.length === 0) return null;

  const changes: TicketTriage = {};
  for (const [field, value] of entries) {
    if (field === "priority" && isOneOf(TICKET_PRIORITIES, value)) {
      changes.priority = value;
    } else if (field === "category" && isOneOf(TICKET_CATEGORIES, value)) {
      changes.category = value;
    } else if (
      field === "assignedToId" &&
      (value === null || (typeof value === "string" && value !== ""))
    ) {
      changes.assignedToId = value;
    } else {
      return null;
    }
  }
  return changes;
}

// Updates whichever of priority, category and assignee are given (at least
// one; see parseTicketTriage). Tickets can only be assigned to staff.
export async function updateTicketTriage(
  ticketId: number,
  changes: TicketTriage,
): Promise<StaffActionResult> {
  if (changes.assignedToId) {
    const [assignee] = await db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.id, changes.assignedToId), inArray(user.role, STAFF_ROLES)));
    if (!assignee) {
      return { ok: false, error: "Tickets can only be assigned to support staff." };
    }
  }

  const updated = await db
    .update(tickets)
    .set(changes)
    .where(eq(tickets.id, ticketId))
    .returning({ id: tickets.id });
  return updated.length > 0 ? { ok: true } : { ok: false, error: TICKET_NOT_FOUND };
}
