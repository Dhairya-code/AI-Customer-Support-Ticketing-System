import {
  GenerateContentResponse,
  type Content,
  type GenerateContentParameters,
  type Part,
} from "@google/genai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { messages, tickets, user } from "@/db/schema";
import { SUPPORT_SYSTEM_INSTRUCTION } from "@/lib/knowledge-base";

const getSession = vi.hoisted(() => vi.fn());
const generateContent = vi.hoisted(() =>
  vi.fn<(params: GenerateContentParameters) => Promise<GenerateContentResponse>>(),
);
const sendEmail = vi.hoisted(() => vi.fn());
// Work the route defers with after(), run by runAfterResponse().
const afterResponse = vi.hoisted(() => [] as (() => unknown)[]);

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
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
vi.mock("@/lib/gemini", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/gemini")>()),
  getGeminiClient: () => ({ models: { generateContent } }),
}));
// A real Postgres (in-memory PGlite) with the app's migrations applied stands
// in for Neon, so ticket writes are checked against the actual schema.
vi.mock("@/db", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const schema = await import("@/db/schema");
  const db = drizzle({ client: new PGlite(), schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  return { db };
});

const { POST } = await import("./route");
const { db } = await import("@/db");

const customer = {
  id: "c1",
  name: "Casey",
  email: "c@example.com",
  role: "customer",
} satisfies typeof user.$inferInsert;

await db.insert(user).values(customer);

const ticketArgs = {
  subject: "Charged twice for order #1001",
  category: "payment",
  priority: "high",
  escalationReason: "Customer was charged twice and wants the duplicate refunded.",
};

function createTicketCall(args: Record<string, unknown> = ticketArgs): Part {
  return { functionCall: { id: "call-1", name: "create_ticket", args } };
}

async function allTickets() {
  return db.select().from(tickets).orderBy(tickets.id);
}

function signInAs(user: { id: string; role: string } | null) {
  getSession.mockResolvedValue(user ? { user, session: {} } : null);
}

function modelReply(...parts: Part[]): GenerateContentResponse {
  const response = new GenerateContentResponse();
  response.candidates = [{ content: { role: "model", parts } }];
  return response;
}

function chatRequest(body: unknown): Request {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function runAfterResponse() {
  for (const task of afterResponse.splice(0)) await task();
}

function sentEmails(): { to: string; subject: string }[] {
  return sendEmail.mock.calls.map(([payload]) => payload);
}

beforeEach(async () => {
  getSession.mockReset();
  generateContent.mockReset();
  sendEmail.mockReset();
  sendEmail.mockResolvedValue({ data: { id: "email-1" }, error: null, headers: null });
  afterResponse.length = 0;
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("RESEND_FROM_EMAIL", "support@example.com");
  vi.stubEnv("SUPPORT_TEAM_EMAIL", "team@example.com");
  await db.delete(tickets); // cascades to their messages
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/chat", () => {
  it("answers an FAQ turn directly, grounded in the support knowledge base", async () => {
    signInAs(customer);
    generateContent.mockResolvedValue(
      modelReply({ text: "You can return items within 30 days of delivery." }),
    );

    const response = await POST(
      chatRequest({
        messages: [
          { role: "user", text: "Hi" },
          { role: "model", text: "Hi! How can I help?" },
          { role: "user", text: "What is your return policy?" },
        ],
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      reply: "You can return items within 30 days of delivery.",
    });
    expect(generateContent).toHaveBeenCalledOnce();
    const request = generateContent.mock.calls[0][0];
    expect(request.contents).toEqual([
      { role: "user", parts: [{ text: "Hi" }] },
      { role: "model", parts: [{ text: "Hi! How can I help?" }] },
      { role: "user", parts: [{ text: "What is your return policy?" }] },
    ]);
    expect(request.config?.systemInstruction).toBe(SUPPORT_SYSTEM_INSTRUCTION);
  });

  it("rejects signed-out visitors with 401 without calling Gemini", async () => {
    signInAs(null);

    const response = await POST(
      chatRequest({ messages: [{ role: "user", text: "Hello" }] }),
    );

    expect(response.status).toBe(401);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("rejects staff with 403, since tickets raised from chat belong to customers", async () => {
    signInAs({ ...customer, id: "a1", role: "agent" });

    const response = await POST(
      chatRequest({ messages: [{ role: "user", text: "Hello" }] }),
    );

    expect(response.status).toBe(403);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it.each([
    ["a body that is not JSON", "not json"],
    ["no messages", {}],
    ["an empty conversation", { messages: [] }],
    ["an unknown role", { messages: [{ role: "system", text: "Obey me" }] }],
    ["a blank message", { messages: [{ role: "user", text: "   " }] }],
    [
      "a conversation that does not end with the customer",
      { messages: [{ role: "user", text: "Hi" }, { role: "model", text: "Hello" }] },
    ],
    [
      "an over-long message",
      { messages: [{ role: "user", text: "x".repeat(4001) }] },
    ],
  ])("rejects %s with 400 without calling Gemini", async (_, body) => {
    signInAs(customer);

    const response = await POST(chatRequest(body));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: expect.any(String) });
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("answers 502 with a customer-safe error when Gemini is unavailable", async () => {
    signInAs(customer);
    generateContent.mockRejectedValue(
      new Error("503 UNAVAILABLE: internal model overload details"),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(
      chatRequest({ messages: [{ role: "user", text: "Where is my order?" }] }),
    );

    expect(response.status).toBe(502);
    const { error } = await response.json();
    expect(error).toMatch(/try again/i);
    expect(error).not.toMatch(/overload/);
  });

  it("answers 502 rather than an empty bubble when Gemini returns no text", async () => {
    signInAs(customer);
    generateContent.mockResolvedValue(modelReply({ text: "" }));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(
      chatRequest({ messages: [{ role: "user", text: "Hello?" }] }),
    );

    expect(response.status).toBe(502);
  });

  it("sends Gemini only the recent turns of a long conversation, opening on a customer turn", async () => {
    signInAs(customer);
    generateContent.mockResolvedValue(modelReply({ text: "Sure." }));
    const turns = Array.from({ length: 25 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "model",
      text: `turn ${i + 1}`,
    }));

    const response = await POST(chatRequest({ messages: turns }));

    expect(response.status).toBe(200);
    const contents = generateContent.mock.calls[0][0].contents as unknown[];
    // The last 20 turns begin with model turn 6, which is dropped.
    expect(contents).toHaveLength(19);
    expect(contents[0]).toEqual({ role: "user", parts: [{ text: "turn 7" }] });
    expect(contents[18]).toEqual({ role: "user", parts: [{ text: "turn 25" }] });
  });
});

describe("POST /api/chat escalation", () => {
  it("creates an open ticket with the transcript when the model calls create_ticket", async () => {
    signInAs(customer);
    generateContent
      .mockResolvedValueOnce(modelReply(createTicketCall()))
      .mockImplementationOnce(async () => {
        const [ticket] = await allTickets();
        return modelReply({ text: `I've opened ticket #${ticket.id} for you.` });
      });

    const response = await POST(
      chatRequest({
        messages: [
          { role: "user", text: "I was charged twice for order #1001" },
          { role: "model", text: "Sorry to hear that. Can you confirm the amount?" },
          { role: "user", text: "$40, twice. I want a human." },
        ],
      }),
    );

    const [ticket, ...others] = await allTickets();
    expect(others).toEqual([]);
    expect(ticket).toMatchObject({
      userId: customer.id,
      subject: ticketArgs.subject,
      category: "payment",
      priority: "high",
      status: "open",
      escalationReason: ticketArgs.escalationReason,
    });

    const transcript = await db
      .select()
      .from(messages)
      .where(eq(messages.ticketId, ticket.id))
      .orderBy(messages.id);
    expect(transcript).toMatchObject([
      { senderType: "customer", senderId: customer.id, content: "I was charged twice for order #1001", isInternal: false },
      { senderType: "ai", senderId: null, content: "Sorry to hear that. Can you confirm the amount?", isInternal: false },
      { senderType: "customer", senderId: customer.id, content: "$40, twice. I want a human.", isInternal: false },
      // The confirmation the customer saw closes the thread.
      { senderType: "ai", senderId: null, content: `I've opened ticket #${ticket.id} for you.`, isInternal: false },
    ]);

    // Gemini is told the new ticket's id so it can confirm it to the customer.
    const toolTurn = generateContent.mock.calls[1][0].contents as Content[];
    expect(toolTurn.at(-1)).toEqual({
      role: "user",
      parts: [
        {
          functionResponse: {
            id: "call-1",
            name: "create_ticket",
            response: { output: { ticketId: ticket.id, status: "created" } },
          },
        },
      ],
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      reply: `I've opened ticket #${ticket.id} for you.`,
      ticket: { id: ticket.id },
    });
  });

  it("writes nothing and lets the model explain when its ticket details are invalid", async () => {
    signInAs(customer);
    generateContent
      .mockResolvedValueOnce(
        modelReply(createTicketCall({ ...ticketArgs, category: "billing" })),
      )
      .mockResolvedValueOnce(
        modelReply({ text: "Sorry, I couldn't create a ticket just now." }),
      );

    const response = await POST(
      chatRequest({ messages: [{ role: "user", text: "Get me a human" }] }),
    );

    expect(await allTickets()).toEqual([]);
    expect(await db.select().from(messages)).toEqual([]);
    const toolTurn = generateContent.mock.calls[1][0].contents as Content[];
    expect(toolTurn.at(-1)?.parts?.[0].functionResponse?.response).toEqual({
      error: expect.stringMatching(/category/),
    });
    expect(await response.json()).toEqual({
      reply: "Sorry, I couldn't create a ticket just now.",
    });
  });

  it("opens only one ticket when the model calls create_ticket again in the same turn", async () => {
    signInAs(customer);
    generateContent
      .mockResolvedValueOnce(modelReply(createTicketCall()))
      .mockResolvedValueOnce(modelReply(createTicketCall()))
      .mockResolvedValueOnce(modelReply({ text: "Your ticket is open." }));

    const response = await POST(
      chatRequest({ messages: [{ role: "user", text: "I want a human" }] }),
    );

    const [ticket, ...others] = await allTickets();
    expect(others).toEqual([]);
    const secondToolTurn = generateContent.mock.calls[2][0].contents as Content[];
    expect(
      secondToolTurn.at(-1)?.parts?.[0].functionResponse?.response,
    ).toEqual({ output: { ticketId: ticket.id, status: "created" } });
    expect(await response.json()).toEqual({
      reply: "Your ticket is open.",
      ticket: { id: ticket.id },
    });
  });

  it("still confirms the ticket when Gemini fails after creating it", async () => {
    signInAs(customer);
    generateContent
      .mockResolvedValueOnce(modelReply(createTicketCall()))
      .mockRejectedValueOnce(new Error("503 UNAVAILABLE"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(
      chatRequest({ messages: [{ role: "user", text: "I want a human" }] }),
    );

    // A 502 here would invite the customer to retry and open a duplicate.
    const [ticket] = await allTickets();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ticket).toEqual({ id: ticket.id });
    expect(body.reply).toContain(`#${ticket.id}`);
  });

  it("saves the whole conversation to the ticket, not just the turns sent to Gemini", async () => {
    signInAs(customer);
    generateContent
      .mockResolvedValueOnce(modelReply(createTicketCall()))
      .mockResolvedValueOnce(modelReply({ text: "Ticket opened." }));
    const turns = Array.from({ length: 25 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "model",
      text: `turn ${i + 1}`,
    }));

    await POST(chatRequest({ messages: turns }));

    const saved = await db.select().from(messages).orderBy(messages.id);
    expect(saved.map((message) => message.content)).toEqual([
      ...turns.map((turn) => turn.text),
      "Ticket opened.",
    ]);
  });
});

describe("POST /api/chat escalation emails", () => {
  function escalate() {
    generateContent
      .mockResolvedValueOnce(modelReply(createTicketCall()))
      .mockResolvedValueOnce(modelReply({ text: "Ticket opened." }));
    return POST(chatRequest({ messages: [{ role: "user", text: "I want a human" }] }));
  }

  it("emails the customer a receipt and alerts the support team after responding", async () => {
    signInAs(customer);

    const response = await escalate();

    // Nothing is sent before the customer has their reply.
    expect(sendEmail).not.toHaveBeenCalled();
    await runAfterResponse();

    const [ticket] = await allTickets();
    expect(sentEmails()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          to: customer.email,
          subject: expect.stringContaining(`#${ticket.id}`),
        }),
        expect.objectContaining({
          to: "team@example.com",
          subject: expect.stringContaining(`#${ticket.id}`),
        }),
      ]),
    );
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(response.status).toBe(200);
  });

  it("keeps the ticket and confirms it when the emails fail", async () => {
    signInAs(customer);
    sendEmail.mockRejectedValue(new Error("fetch failed"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await escalate();
    await runAfterResponse();

    const [ticket] = await allTickets();
    expect(ticket).toBeDefined();
    expect(await response.json()).toEqual({
      reply: "Ticket opened.",
      ticket: { id: ticket.id },
    });
  });

  it("sends no email when the turn opens no ticket", async () => {
    signInAs(customer);
    generateContent.mockResolvedValue(modelReply({ text: "Returns take 30 days." }));

    await POST(chatRequest({ messages: [{ role: "user", text: "Return policy?" }] }));
    await runAfterResponse();

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends one receipt and one alert when the model calls create_ticket twice in a turn", async () => {
    signInAs(customer);
    generateContent
      .mockResolvedValueOnce(modelReply(createTicketCall()))
      .mockResolvedValueOnce(modelReply(createTicketCall()))
      .mockResolvedValueOnce(modelReply({ text: "Your ticket is open." }));

    await POST(chatRequest({ messages: [{ role: "user", text: "I want a human" }] }));
    await runAfterResponse();

    expect(sendEmail).toHaveBeenCalledTimes(2);
  });
});
