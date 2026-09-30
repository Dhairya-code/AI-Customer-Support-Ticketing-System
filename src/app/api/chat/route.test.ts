import {
  GenerateContentResponse,
  type GenerateContentParameters,
  type Part,
} from "@google/genai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SUPPORT_SYSTEM_INSTRUCTION } from "@/lib/knowledge-base";

const getSession = vi.hoisted(() => vi.fn());
const generateContent = vi.hoisted(() =>
  vi.fn<(params: GenerateContentParameters) => Promise<GenerateContentResponse>>(),
);

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/lib/gemini", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/gemini")>()),
  getGeminiClient: () => ({ models: { generateContent } }),
}));

const { POST } = await import("./route");

const customer = { id: "c1", name: "Casey", email: "c@example.com", role: "customer" };

function signInAs(user: typeof customer | null) {
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

beforeEach(() => {
  getSession.mockReset();
  generateContent.mockReset();
});

afterEach(() => {
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

  it("does not raise a ticket yet when the model escalates; the model explains instead", async () => {
    signInAs(customer);
    generateContent
      .mockResolvedValueOnce(
        modelReply({
          functionCall: {
            name: "create_ticket",
            args: {
              subject: "Charged twice",
              category: "payment",
              priority: "high",
              escalationReason: "Duplicate charge.",
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        modelReply({ text: "Sorry, I couldn't create a ticket right now." }),
      );

    const response = await POST(
      chatRequest({ messages: [{ role: "user", text: "I was charged twice!" }] }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      reply: "Sorry, I couldn't create a ticket right now.",
    });
    const toolResponse = generateContent.mock.calls[1][0].contents;
    expect(JSON.stringify(toolResponse)).toMatch(/"error"/);
  });

  it("sends Gemini only the recent turns of a long conversation, opening on a customer turn", async () => {
    signInAs(customer);
    generateContent.mockResolvedValue(modelReply({ text: "Sure." }));
    const messages = Array.from({ length: 25 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "model",
      text: `turn ${i + 1}`,
    }));

    const response = await POST(chatRequest({ messages }));

    expect(response.status).toBe(200);
    const contents = generateContent.mock.calls[0][0].contents as unknown[];
    // The last 20 turns begin with model turn 6, which is dropped.
    expect(contents).toHaveLength(19);
    expect(contents[0]).toEqual({ role: "user", parts: [{ text: "turn 7" }] });
    expect(contents[18]).toEqual({ role: "user", parts: [{ text: "turn 25" }] });
  });
});
