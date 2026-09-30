import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { messages, tickets, user, type NewTicket } from "@/db/schema";

// A real Postgres (in-memory PGlite) with the app's migrations applied stands
// in for Neon, so queries are checked against the actual schema.
vi.mock("@/db", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const schema = await import("@/db/schema");
  const db = drizzle({ client: new PGlite(), schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  return { db };
});

const {
  addStaffMessage,
  getQueueMetrics,
  getStaffTicketDetail,
  listQueueTickets,
  parseQueueFilters,
} = await import("./staff-tickets");
const { db } = await import("@/db");

const caseyJoined = new Date("2026-01-15T09:00:00Z");
await db.insert(user).values([
  {
    id: "c1",
    name: "Casey",
    email: "casey@example.com",
    role: "customer",
    createdAt: caseyJoined,
  },
  { id: "c2", name: "Robin", email: "robin@example.com", role: "customer" },
  { id: "a1", name: "Alex", email: "alex@example.com", role: "agent" },
]);

function ticket(overrides: Partial<NewTicket> & { subject: string }): NewTicket {
  return { userId: "c1", escalationReason: "Needs a human.", ...overrides };
}

beforeEach(async () => {
  await db.delete(tickets);
});

describe("parseQueueFilters", () => {
  it("keeps recognised status, priority and category values", () => {
    expect(
      parseQueueFilters({ status: "in_progress", priority: "critical", category: "refund" }),
    ).toEqual({ status: "in_progress", priority: "critical", category: "refund" });
  });

  it("drops missing, empty and unknown values", () => {
    expect(
      parseQueueFilters({ status: "", priority: "urgent", category: undefined }),
    ).toEqual({});
  });

  it("uses the first value when a parameter is repeated", () => {
    expect(parseQueueFilters({ status: ["resolved", "open"] })).toEqual({
      status: "resolved",
    });
  });
});

describe("getQueueMetrics", () => {
  it("counts all tickets, open ones, high/critical ones and resolved ones", async () => {
    await db.insert(tickets).values([
      ticket({ subject: "A", status: "open", priority: "critical" }),
      ticket({ subject: "B", status: "open", priority: "low" }),
      ticket({ subject: "C", status: "in_progress", priority: "high" }),
      ticket({ subject: "D", status: "resolved", priority: "medium" }),
      ticket({ subject: "E", status: "closed", priority: "high", userId: "c2" }),
    ]);

    expect(await getQueueMetrics()).toEqual({
      total: 5,
      open: 2,
      highOrCritical: 3,
      resolved: 1,
    });
  });

  it("is all zeroes for an empty queue", async () => {
    expect(await getQueueMetrics()).toEqual({
      total: 0,
      open: 0,
      highOrCritical: 0,
      resolved: 0,
    });
  });
});

describe("listQueueTickets", () => {
  it("lists every customer's tickets newest first, with the customer's name and email", async () => {
    const createdAt = new Date("2026-09-03T10:00:00Z");
    await db.insert(tickets).values([
      ticket({ subject: "Older", createdAt: new Date("2026-09-01T10:00:00Z") }),
      ticket({
        subject: "Charged twice",
        userId: "c2",
        category: "payment",
        priority: "high",
        status: "in_progress",
        createdAt,
      }),
    ]);

    const [newest, older] = await listQueueTickets({});

    expect(newest).toEqual({
      id: expect.any(Number),
      subject: "Charged twice",
      category: "payment",
      priority: "high",
      status: "in_progress",
      createdAt,
      customerName: "Robin",
      customerEmail: "robin@example.com",
    });
    expect(older.subject).toBe("Older");
  });

  it("orders tickets created at the same moment by newest id", async () => {
    const at = new Date("2026-09-03T10:00:00Z");
    await db.insert(tickets).values(ticket({ subject: "First", createdAt: at }));
    await db.insert(tickets).values(ticket({ subject: "Second", createdAt: at }));

    const list = await listQueueTickets({});

    expect(list.map((t) => t.subject)).toEqual(["Second", "First"]);
  });

  it("applies every filter given", async () => {
    await db.insert(tickets).values([
      ticket({ subject: "Match", status: "open", priority: "high", category: "refund" }),
      ticket({ subject: "Wrong status", status: "closed", priority: "high", category: "refund" }),
      ticket({ subject: "Wrong priority", status: "open", priority: "low", category: "refund" }),
      ticket({ subject: "Wrong category", status: "open", priority: "high", category: "order" }),
    ]);

    const list = await listQueueTickets({
      status: "open",
      priority: "high",
      category: "refund",
    });

    expect(list.map((t) => t.subject)).toEqual(["Match"]);
  });

  it("filters on a single field", async () => {
    await db.insert(tickets).values([
      ticket({ subject: "Resolved", status: "resolved" }),
      ticket({ subject: "Open", status: "open" }),
    ]);

    const list = await listQueueTickets({ status: "resolved" });

    expect(list.map((t) => t.subject)).toEqual(["Resolved"]);
  });
});

describe("getStaffTicketDetail", () => {
  async function insertTicket(overrides: Partial<NewTicket> & { subject: string }) {
    const [{ id }] = await db
      .insert(tickets)
      .values(ticket(overrides))
      .returning({ id: tickets.id });
    return id;
  }

  it("returns the full ticket, including the escalation reason", async () => {
    const createdAt = new Date("2026-09-03T10:00:00Z");
    const id = await insertTicket({
      subject: "Charged twice",
      category: "payment",
      priority: "high",
      status: "in_progress",
      escalationReason: "Duplicate charge needs a billing refund.",
      createdAt,
    });

    const detail = await getStaffTicketDetail(id);

    expect(detail?.ticket).toEqual({
      id,
      subject: "Charged twice",
      category: "payment",
      priority: "high",
      status: "in_progress",
      escalationReason: "Duplicate charge needs a billing refund.",
      createdAt,
      updatedAt: expect.any(Date),
    });
  });

  it("returns the customer's profile and how many tickets they opened before this one", async () => {
    const at = new Date("2026-09-03T10:00:00Z");
    await insertTicket({ subject: "Earlier", createdAt: new Date("2026-08-01T10:00:00Z") });
    await insertTicket({ subject: "Same moment, earlier id", createdAt: at });
    const id = await insertTicket({ subject: "This one", createdAt: at });
    await insertTicket({ subject: "Later", createdAt: new Date("2026-09-10T10:00:00Z") });
    await insertTicket({ subject: "Someone else's", userId: "c2", createdAt: new Date("2026-01-01T10:00:00Z") });

    const detail = await getStaffTicketDetail(id);

    expect(detail?.customer).toEqual({
      id: "c1",
      name: "Casey",
      email: "casey@example.com",
      createdAt: caseyJoined,
      previousTicketCount: 2,
    });
  });

  it("returns every message oldest first, internal notes included, with agent names", async () => {
    const id = await insertTicket({ subject: "Charged twice" });
    await db.insert(messages).values([
      { ticketId: id, senderType: "customer", senderId: "c1", content: "I was charged twice", createdAt: new Date("2026-09-01T10:00:00Z") },
      { ticketId: id, senderType: "ai", content: "I've opened a ticket.", createdAt: new Date("2026-09-01T10:01:00Z") },
      { ticketId: id, senderType: "agent", senderId: "a1", content: "Checking with billing.", isInternal: true, createdAt: new Date("2026-09-01T11:00:00Z") },
      { ticketId: id, senderType: "customer", senderId: "c1", content: "Any update?", createdAt: new Date("2026-09-01T12:00:00Z") },
    ]);

    const detail = await getStaffTicketDetail(id);

    expect(
      detail?.messages.map((m) => [m.senderType, m.senderName, m.content, m.isInternal]),
    ).toEqual([
      ["customer", "Casey", "I was charged twice", false],
      ["ai", null, "I've opened a ticket.", false],
      ["agent", "Alex", "Checking with billing.", true],
      ["customer", "Casey", "Any update?", false],
    ]);
  });

  it("returns null for a ticket that does not exist", async () => {
    expect(await getStaffTicketDetail(999_999)).toBeNull();
  });
});

describe("addStaffMessage", () => {
  const longAgo = new Date("2026-01-01T00:00:00Z");
  let ticketId: number;

  beforeEach(async () => {
    [{ id: ticketId }] = await db
      .insert(tickets)
      .values(ticket({ subject: "Charged twice", updatedAt: longAgo }))
      .returning({ id: tickets.id });
  });

  async function savedMessages() {
    return db.select().from(messages).where(eq(messages.ticketId, ticketId));
  }

  async function updatedAt() {
    const [row] = await db
      .select({ updatedAt: tickets.updatedAt })
      .from(tickets)
      .where(eq(tickets.id, ticketId));
    return row.updatedAt;
  }

  it("saves a public reply from the agent and returns who to notify", async () => {
    const result = await addStaffMessage({
      agentId: "a1",
      ticketId,
      content: "  We've refunded the duplicate charge.  ",
      kind: "reply",
    });

    expect(result).toEqual({
      ok: true,
      customer: { name: "Casey", email: "casey@example.com" },
    });
    expect(await savedMessages()).toMatchObject([
      {
        senderType: "agent",
        senderId: "a1",
        content: "We've refunded the duplicate charge.",
        isInternal: false,
      },
    ]);
    expect(await updatedAt()).not.toEqual(longAgo);
  });

  it("saves an internal note as a staff-only message", async () => {
    const result = await addStaffMessage({
      agentId: "a1",
      ticketId,
      content: "Checking with billing.",
      kind: "note",
    });

    expect(result).toMatchObject({ ok: true });
    expect(await savedMessages()).toMatchObject([
      { senderType: "agent", senderId: "a1", content: "Checking with billing.", isInternal: true },
    ]);
  });

  it("keeps internal notes out of the customer's view of the thread", async () => {
    const { getCustomerTicketThread } = await import("./tickets");
    await addStaffMessage({ agentId: "a1", ticketId, content: "Staff only", kind: "note" });
    await addStaffMessage({ agentId: "a1", ticketId, content: "Hello Casey", kind: "reply" });

    const thread = await getCustomerTicketThread("c1", ticketId);

    expect(thread?.messages.map((m) => m.content)).toEqual(["Hello Casey"]);
  });

  it.each([
    ["an empty message", "   "],
    ["a message over the length limit", "x".repeat(4001)],
  ])("refuses %s", async (_, content) => {
    const result = await addStaffMessage({ agentId: "a1", ticketId, content, kind: "reply" });

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(await savedMessages()).toEqual([]);
  });

  it("refuses a ticket that does not exist", async () => {
    const result = await addStaffMessage({
      agentId: "a1",
      ticketId: 999_999,
      content: "Hello",
      kind: "note",
    });

    expect(result).toEqual({ ok: false, error: expect.stringMatching(/not be found/i) });
  });

  it("refuses a public reply on a closed ticket but still takes internal notes", async () => {
    await db.update(tickets).set({ status: "closed" }).where(eq(tickets.id, ticketId));

    const reply = await addStaffMessage({ agentId: "a1", ticketId, content: "Hi", kind: "reply" });
    const note = await addStaffMessage({ agentId: "a1", ticketId, content: "FYI", kind: "note" });

    expect(reply).toEqual({ ok: false, error: expect.stringMatching(/closed/i) });
    expect(note).toMatchObject({ ok: true });
    expect((await savedMessages()).map((m) => m.content)).toEqual(["FYI"]);
  });
});
