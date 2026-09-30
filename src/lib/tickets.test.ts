import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { messages, tickets, user, type TicketStatus } from "@/db/schema";
import { MAX_MESSAGE_LENGTH } from "./chat";

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
  addCustomerReply,
  getCustomerTicketThread,
  listCustomerTickets,
  parseTicketId,
} = await import("./tickets");
const { db } = await import("@/db");

await db.insert(user).values([
  { id: "c1", name: "Casey", email: "casey@example.com", role: "customer" },
  { id: "c2", name: "Robin", email: "robin@example.com", role: "customer" },
]);

function ticket(userId: string, subject: string, createdAt: Date) {
  return { userId, subject, createdAt, escalationReason: "Needs a human." };
}

beforeEach(async () => {
  await db.delete(tickets);
});

describe("listCustomerTickets", () => {
  it("lists only the customer's own tickets, newest first", async () => {
    await db.insert(tickets).values([
      ticket("c1", "Oldest", new Date("2026-09-01T10:00:00Z")),
      ticket("c2", "Someone else's", new Date("2026-09-02T10:00:00Z")),
      ticket("c1", "Newest", new Date("2026-09-03T10:00:00Z")),
      ticket("c1", "Middle", new Date("2026-09-02T12:00:00Z")),
    ]);

    const list = await listCustomerTickets("c1");

    expect(list.map((t) => t.subject)).toEqual(["Newest", "Middle", "Oldest"]);
  });

  it("returns the fields the overview shows", async () => {
    const createdAt = new Date("2026-09-03T10:00:00Z");
    const [{ id }] = await db
      .insert(tickets)
      .values({
        ...ticket("c1", "Charged twice", createdAt),
        category: "payment",
        priority: "high",
        status: "in_progress",
      })
      .returning({ id: tickets.id });

    expect(await listCustomerTickets("c1")).toEqual([
      {
        id,
        subject: "Charged twice",
        category: "payment",
        priority: "high",
        status: "in_progress",
        createdAt,
      },
    ]);
  });

  it("orders tickets created at the same moment by newest id", async () => {
    const at = new Date("2026-09-03T10:00:00Z");
    await db.insert(tickets).values(ticket("c1", "First", at));
    await db.insert(tickets).values(ticket("c1", "Second", at));

    const list = await listCustomerTickets("c1");

    expect(list.map((t) => t.subject)).toEqual(["Second", "First"]);
  });

  it("returns an empty list for a customer with no tickets", async () => {
    expect(await listCustomerTickets("c2")).toEqual([]);
  });
});

describe("parseTicketId", () => {
  it.each([
    ["1", 1],
    ["42", 42],
    [42, 42],
    ["2147483647", 2_147_483_647],
  ])("accepts %j", (value, expected) => {
    expect(parseTicketId(value)).toBe(expected);
  });

  // Out-of-range ids would make Postgres reject the query on its int column.
  it.each(["0", "-1", "1.5", "1e3", " 1", "abc", "", "2147483648", 1.5, 0, null, undefined])(
    "rejects %j",
    (value) => {
      expect(parseTicketId(value)).toBeNull();
    },
  );
});

async function openTicket(
  userId = "c1",
  status: TicketStatus = "open",
): Promise<number> {
  const [{ id }] = await db
    .insert(tickets)
    .values({ ...ticket(userId, "Charged twice", new Date()), status })
    .returning({ id: tickets.id });
  return id;
}

describe("getCustomerTicketThread", () => {
  it("returns the ticket and its public messages, oldest first", async () => {
    const ticketId = await openTicket();
    await db.insert(messages).values([
      { ticketId, senderType: "customer", senderId: "c1", content: "I was charged twice", createdAt: new Date("2026-09-01T10:00:00Z") },
      { ticketId, senderType: "ai", content: "I've opened a ticket.", createdAt: new Date("2026-09-01T10:01:00Z") },
      { ticketId, senderType: "agent", content: "Checking with billing.", isInternal: true, createdAt: new Date("2026-09-01T11:00:00Z") },
      { ticketId, senderType: "agent", content: "We've refunded you.", createdAt: new Date("2026-09-01T12:00:00Z") },
    ]);

    const thread = await getCustomerTicketThread("c1", ticketId);

    expect(thread?.ticket).toMatchObject({
      id: ticketId,
      subject: "Charged twice",
      status: "open",
    });
    // The internal note is never sent to the customer.
    expect(thread?.messages.map((m) => [m.senderType, m.content])).toEqual([
      ["customer", "I was charged twice"],
      ["ai", "I've opened a ticket."],
      ["agent", "We've refunded you."],
    ]);
    expect(thread?.messages[0]).not.toHaveProperty("isInternal");
  });

  it("returns null for another customer's ticket", async () => {
    const ticketId = await openTicket("c2");

    expect(await getCustomerTicketThread("c1", ticketId)).toBeNull();
  });

  it("returns null for a ticket that does not exist", async () => {
    expect(await getCustomerTicketThread("c1", 999_999)).toBeNull();
  });
});

describe("addCustomerReply", () => {
  async function thread(ticketId: number) {
    return db
      .select()
      .from(messages)
      .where(eq(messages.ticketId, ticketId))
      .orderBy(messages.id);
  }

  it("saves the reply as a public customer message and marks the ticket updated", async () => {
    const ticketId = await openTicket();
    const stale = new Date("2026-01-01T00:00:00Z");
    await db.update(tickets).set({ updatedAt: stale }).where(eq(tickets.id, ticketId));

    const result = await addCustomerReply({
      customerId: "c1",
      ticketId,
      content: "  Any update?  ",
    });

    expect(result).toEqual({ ok: true });
    expect(await thread(ticketId)).toMatchObject([
      { senderType: "customer", senderId: "c1", content: "Any update?", isInternal: false },
    ]);
    const [{ updatedAt }] = await db
      .select({ updatedAt: tickets.updatedAt })
      .from(tickets)
      .where(eq(tickets.id, ticketId));
    expect(updatedAt.getTime()).toBeGreaterThan(stale.getTime());
  });

  it.each(["in_progress", "resolved"] as const)(
    "accepts replies on a %s ticket",
    async (status) => {
      const ticketId = await openTicket("c1", status);

      expect(
        await addCustomerReply({ customerId: "c1", ticketId, content: "Thanks" }),
      ).toEqual({ ok: true });
    },
  );

  it("refuses replies on a closed ticket", async () => {
    const ticketId = await openTicket("c1", "closed");

    const result = await addCustomerReply({ customerId: "c1", ticketId, content: "Hello?" });

    expect(result).toEqual({ ok: false, error: expect.stringMatching(/closed/i) });
    expect(await thread(ticketId)).toEqual([]);
  });

  it("refuses replies to another customer's ticket", async () => {
    const ticketId = await openTicket("c2");

    const result = await addCustomerReply({ customerId: "c1", ticketId, content: "Hi" });

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(await thread(ticketId)).toEqual([]);
  });

  it.each([
    ["a blank reply", "   "],
    ["an over-long reply", "x".repeat(MAX_MESSAGE_LENGTH + 1)],
  ])("refuses %s", async (_, content) => {
    const ticketId = await openTicket();

    const result = await addCustomerReply({ customerId: "c1", ticketId, content });

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(await thread(ticketId)).toEqual([]);
  });
});
