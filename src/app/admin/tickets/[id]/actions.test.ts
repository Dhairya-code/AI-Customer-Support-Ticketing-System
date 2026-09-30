import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { messages, tickets, user } from "@/db/schema";

const getSession = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());
const sendEmail = vi.hoisted(() => vi.fn());
// Work the action defers with after(), run by runAfterResponse().
const afterResponse = vi.hoisted(() => [] as (() => unknown)[]);

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ refresh, revalidatePath }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => unknown) => afterResponse.push(task),
}));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendEmail };
  },
}));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
// A real Postgres (in-memory PGlite) with the app's migrations applied stands
// in for Neon, so message writes are checked against the actual schema.
vi.mock("@/db", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const schema = await import("@/db/schema");
  const db = drizzle({ client: new PGlite(), schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  return { db };
});

const { changeTicketStatus, postStaffMessage, triageTicket } = await import(
  "./actions"
);
const { db } = await import("@/db");

const customer = {
  id: "c1",
  name: "Casey",
  email: "casey@example.com",
  role: "customer",
} satisfies typeof user.$inferInsert;
const agent = {
  id: "a1",
  name: "Alex",
  email: "alex@example.com",
  role: "agent",
} satisfies typeof user.$inferInsert;

await db.insert(user).values([customer, agent]);

function signInAs(user: { id: string; role: string } | null) {
  getSession.mockResolvedValue(user ? { user, session: {} } : null);
}

async function runAfterResponse() {
  for (const task of afterResponse.splice(0)) await task();
}

let ticketId: number;

beforeEach(async () => {
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("RESEND_FROM_EMAIL", "support@example.com");
  getSession.mockReset();
  refresh.mockReset();
  revalidatePath.mockReset();
  sendEmail.mockReset();
  sendEmail.mockResolvedValue({ data: { id: "email-1" }, error: null, headers: null });
  afterResponse.length = 0;
  await db.delete(tickets);
  [{ id: ticketId }] = await db
    .insert(tickets)
    .values({ userId: customer.id, subject: "Charged twice" })
    .returning({ id: tickets.id });
});

async function savedMessages() {
  return db.select().from(messages).where(eq(messages.ticketId, ticketId));
}

describe("postStaffMessage", () => {
  it("saves a public reply, refreshes the page and emails the customer after responding", async () => {
    signInAs(agent);

    const result = await postStaffMessage(ticketId, "Refund issued.", "reply");

    expect(result).toEqual({ ok: true });
    expect(await savedMessages()).toMatchObject([
      { senderType: "agent", senderId: agent.id, content: "Refund issued.", isInternal: false },
    ]);
    expect(refresh).toHaveBeenCalledOnce();
    expect(sendEmail).not.toHaveBeenCalled();

    await runAfterResponse();

    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail.mock.calls[0][0]).toMatchObject({
      to: customer.email,
      subject: expect.stringContaining(`#${ticketId}`),
      text: expect.stringContaining("Refund issued."),
    });
  });

  it("saves an internal note without emailing anyone", async () => {
    signInAs({ ...agent, role: "admin" });

    const result = await postStaffMessage(ticketId, "Checking with billing.", "note");

    expect(result).toEqual({ ok: true });
    expect(await savedMessages()).toMatchObject([
      { senderType: "agent", content: "Checking with billing.", isInternal: true },
    ]);
    expect(refresh).toHaveBeenCalledOnce();
    await runAfterResponse();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("still reports success when the email fails", async () => {
    signInAs(agent);
    sendEmail.mockRejectedValue(new Error("network down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await postStaffMessage(ticketId, "Refund issued.", "reply")).toEqual({ ok: true });
    await runAfterResponse();

    expect(await savedMessages()).toHaveLength(1);
  });

  it.each([
    ["signed-out visitors", null],
    ["customers", customer],
  ])("refuses %s", async (_, who) => {
    signInAs(who);

    const result = await postStaffMessage(ticketId, "Hello", "reply");

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(await savedMessages()).toEqual([]);
    expect(refresh).not.toHaveBeenCalled();
    expect(afterResponse).toEqual([]);
  });

  it("passes on a refusal from the ticket rules without refreshing or emailing", async () => {
    signInAs(agent);
    await db.update(tickets).set({ status: "closed" }).where(eq(tickets.id, ticketId));

    const result = await postStaffMessage(ticketId, "Hello?", "reply");

    expect(result).toEqual({ ok: false, error: expect.stringMatching(/closed/i) });
    expect(refresh).not.toHaveBeenCalled();
    expect(afterResponse).toEqual([]);
  });

  // Server Action arguments come straight from the client.
  it.each([
    ["a non-integer ticket id", 1.5, "Hi", "reply"],
    ["content that is not a string", "ticket", 42, "reply"],
    ["an unknown message kind", "ticket", "Hi", "broadcast"],
  ])("refuses %s", async (_, id, content, kind) => {
    signInAs(agent);

    const result = await postStaffMessage(
      (id === "ticket" ? ticketId : id) as number,
      content as string,
      kind as "reply",
    );

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(await savedMessages()).toEqual([]);
    expect(refresh).not.toHaveBeenCalled();
  });
});

async function currentTicket() {
  const [row] = await db.select().from(tickets).where(eq(tickets.id, ticketId));
  return row;
}

describe("changeTicketStatus", () => {
  it("changes the status, notes who did it in the thread and refreshes the page", async () => {
    signInAs(agent);

    expect(await changeTicketStatus(ticketId, "in_progress")).toEqual({ ok: true });

    expect((await currentTicket()).status).toBe("in_progress");
    expect(await savedMessages()).toMatchObject([
      { senderType: "system", content: "Ticket marked as In progress by Alex" },
    ]);
    expect(refresh).toHaveBeenCalledOnce();
    // The dashboard's metrics and table show the new status on the next visit.
    expect(revalidatePath).toHaveBeenCalledWith("/admin");
  });

  it("passes on a refusal from the ticket rules without refreshing", async () => {
    signInAs(agent);
    await db.update(tickets).set({ status: "closed" }).where(eq(tickets.id, ticketId));

    const result = await changeTicketStatus(ticketId, "open");

    expect(result).toEqual({ ok: false, error: expect.stringMatching(/closed/i) });
    expect(refresh).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ["signed-out visitors", null],
    ["customers", customer],
  ])("refuses %s", async (_, who) => {
    signInAs(who);

    expect(await changeTicketStatus(ticketId, "closed")).toEqual({
      ok: false,
      error: expect.any(String),
    });
    expect((await currentTicket()).status).toBe("open");
    expect(refresh).not.toHaveBeenCalled();
  });

  it.each([
    ["an unknown status", "ticket", "archived"],
    ["an invalid ticket id", -1, "closed"],
  ])("refuses %s", async (_, id, status) => {
    signInAs(agent);

    const result = await changeTicketStatus(
      (id === "ticket" ? ticketId : id) as number,
      status as "closed",
    );

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(await savedMessages()).toEqual([]);
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("triageTicket", () => {
  it("updates priority, category and assignee and refreshes the page", async () => {
    signInAs(agent);

    const result = await triageTicket(ticketId, {
      priority: "critical",
      category: "refund",
      assignedToId: agent.id,
    });

    expect(result).toEqual({ ok: true });
    expect(await currentTicket()).toMatchObject({
      priority: "critical",
      category: "refund",
      assignedToId: agent.id,
    });
    expect(refresh).toHaveBeenCalledOnce();
    expect(revalidatePath).toHaveBeenCalledWith("/admin");
  });

  it("refuses customers", async () => {
    signInAs(customer);

    expect(await triageTicket(ticketId, { priority: "critical" })).toEqual({
      ok: false,
      error: expect.any(String),
    });
    expect((await currentTicket()).priority).toBe("medium");
  });

  it("passes on a refusal from the ticket rules without refreshing", async () => {
    signInAs(agent);

    const result = await triageTicket(ticketId, { assignedToId: customer.id });

    expect(result).toEqual({ ok: false, error: expect.stringMatching(/staff/i) });
    expect(refresh).not.toHaveBeenCalled();
  });

  // Server Action arguments come straight from the client.
  it.each([
    ["an unknown priority", { priority: "urgent" }],
    ["an unknown category", { category: "misc" }],
    ["an assignee that is not a string", { assignedToId: 7 }],
    ["an unexpected field", { status: "closed" }],
    ["changes that are not an object", "critical"],
    ["no changes at all", null],
  ])("refuses %s", async (_, changes) => {
    signInAs(agent);

    const result = await triageTicket(ticketId, changes as never);

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(await currentTicket()).toMatchObject({ priority: "medium", status: "open" });
    expect(refresh).not.toHaveBeenCalled();
  });
});
