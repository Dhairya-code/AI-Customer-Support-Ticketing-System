import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { messages, tickets, user } from "@/db/schema";

const getSession = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ refresh }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
// A real Postgres (in-memory PGlite) with the app's migrations applied stands
// in for Neon, so reply writes are checked against the actual schema.
vi.mock("@/db", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const schema = await import("@/db/schema");
  const db = drizzle({ client: new PGlite(), schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  return { db };
});

const { replyToTicket } = await import("./actions");
const { db } = await import("@/db");

const customer = {
  id: "c1",
  name: "Casey",
  email: "casey@example.com",
  role: "customer",
} satisfies typeof user.$inferInsert;

await db.insert(user).values(customer);

function signInAs(user: { id: string; role: string } | null) {
  getSession.mockResolvedValue(user ? { user, session: {} } : null);
}

let ticketId: number;

beforeEach(async () => {
  getSession.mockReset();
  refresh.mockReset();
  await db.delete(tickets);
  [{ id: ticketId }] = await db
    .insert(tickets)
    .values({ userId: customer.id, subject: "Charged twice" })
    .returning({ id: tickets.id });
});

async function savedReplies() {
  return db.select().from(messages).where(eq(messages.ticketId, ticketId));
}

describe("replyToTicket", () => {
  it("saves the customer's reply and refreshes the page", async () => {
    signInAs(customer);

    expect(await replyToTicket(ticketId, "Any update?")).toEqual({ ok: true });

    expect(await savedReplies()).toMatchObject([
      { senderType: "customer", senderId: customer.id, content: "Any update?" },
    ]);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it.each([
    ["signed-out visitors", null],
    ["staff", { ...customer, id: "a1", role: "agent" }],
  ])("refuses %s", async (_, who) => {
    signInAs(who);

    const result = await replyToTicket(ticketId, "Hello");

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(await savedReplies()).toEqual([]);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("passes on a refusal from the ticket rules without refreshing", async () => {
    signInAs(customer);
    await db.update(tickets).set({ status: "closed" }).where(eq(tickets.id, ticketId));

    const result = await replyToTicket(ticketId, "Hello?");

    expect(result).toEqual({ ok: false, error: expect.stringMatching(/closed/i) });
    expect(refresh).not.toHaveBeenCalled();
  });

  // Server Action arguments come straight from the client.
  it.each([
    ["a non-integer ticket id", 1.5],
    ["a ticket id beyond the id column's range", 2 ** 31],
  ])("refuses %s", async (_, id) => {
    signInAs(customer);

    const result = await replyToTicket(id, "Hi");

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refuses content that is not a string", async () => {
    signInAs(customer);

    const result = await replyToTicket(ticketId, 42 as unknown as string);

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(await savedReplies()).toEqual([]);
  });
});
