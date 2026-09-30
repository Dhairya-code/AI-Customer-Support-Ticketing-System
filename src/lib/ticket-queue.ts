import "server-only";
import { and, count, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  tickets,
  user,
  type Ticket,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
} from "@/db/schema";

// The staff triage queue at /admin: every customer's tickets, not just one's.

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
