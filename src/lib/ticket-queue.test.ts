import { beforeEach, describe, expect, it, vi } from "vitest";
import { tickets, user, type NewTicket } from "@/db/schema";

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

const { getQueueMetrics, listQueueTickets, parseQueueFilters } = await import(
  "./ticket-queue"
);
const { db } = await import("@/db");

await db.insert(user).values([
  { id: "c1", name: "Casey", email: "casey@example.com", role: "customer" },
  { id: "c2", name: "Robin", email: "robin@example.com", role: "customer" },
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
