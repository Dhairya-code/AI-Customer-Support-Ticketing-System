import { beforeEach, describe, expect, it, vi } from "vitest";
import { tickets, user } from "@/db/schema";

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

const { listCustomerTickets } = await import("./tickets");
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
