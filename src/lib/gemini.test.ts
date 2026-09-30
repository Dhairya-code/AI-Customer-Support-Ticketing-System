import {
  GenerateContentResponse,
  type GenerateContentParameters,
  type Part,
} from "@google/genai";
import { describe, expect, it, vi } from "vitest";
import {
  CREATE_TICKET_TOOL,
  parseCreateTicketArgs,
  runConversation,
} from "./gemini";

function modelReply(...parts: Part[]): GenerateContentResponse {
  const response = new GenerateContentResponse();
  response.candidates = [{ content: { role: "model", parts } }];
  return response;
}

// Stands in for the Gemini API: replays canned replies and records requests.
function fakeGemini(...replies: GenerateContentResponse[]) {
  const requests: GenerateContentParameters[] = [];
  const generateContent = vi.fn(async (params: GenerateContentParameters) => {
    // Snapshot contents: the runner may keep appending to the same array.
    requests.push({ ...params, contents: structuredClone(params.contents) });
    const reply = replies.shift();
    if (!reply) throw new Error("Unexpected extra Gemini request");
    return reply;
  });
  return { ai: { models: { generateContent } }, requests };
}

describe("runConversation", () => {
  it("returns the model's answer and sends history, system prompt and tools", async () => {
    const { ai, requests } = fakeGemini(
      modelReply({ text: "Returns are accepted within 30 days." }),
    );

    const result = await runConversation({
      ai,
      systemInstruction: "You are a support assistant.",
      tools: [CREATE_TICKET_TOOL],
      history: [
        { role: "user", text: "Hi" },
        { role: "model", text: "Hello! How can I help?" },
        { role: "user", text: "What is your return policy?" },
      ],
      onToolCall: vi.fn(),
    });

    expect(result).toEqual({
      text: "Returns are accepted within 30 days.",
      toolCalls: [],
    });
    expect(requests).toHaveLength(1);
    expect(requests[0].contents).toEqual([
      { role: "user", parts: [{ text: "Hi" }] },
      { role: "model", parts: [{ text: "Hello! How can I help?" }] },
      { role: "user", parts: [{ text: "What is your return policy?" }] },
    ]);
    expect(requests[0].config?.systemInstruction).toBe(
      "You are a support assistant.",
    );
    expect(requests[0].config?.tools).toEqual([
      { functionDeclarations: [CREATE_TICKET_TOOL] },
    ]);
  });

  it("runs a requested tool, returns its result to the model, and relays the follow-up answer", async () => {
    const ticketArgs = {
      subject: "Payment deducted but order not confirmed",
      category: "payment",
      priority: "high",
      escalationReason: "Customer was charged without an order confirmation.",
    };
    const callPart: Part = {
      functionCall: { id: "call-1", name: "create_ticket", args: ticketArgs },
      thoughtSignature: "sig-abc",
    };
    const { ai, requests } = fakeGemini(
      modelReply(callPart),
      modelReply({ text: "I've opened ticket #42 for you." }),
    );
    const onToolCall = vi.fn(async () => ({ ticketId: 42, status: "created" }));

    const result = await runConversation({
      ai,
      systemInstruction: "You are a support assistant.",
      tools: [CREATE_TICKET_TOOL],
      history: [{ role: "user", text: "I was charged but have no order!" }],
      onToolCall,
    });

    expect(onToolCall).toHaveBeenCalledExactlyOnceWith({
      name: "create_ticket",
      args: ticketArgs,
    });
    expect(result).toEqual({
      text: "I've opened ticket #42 for you.",
      toolCalls: [
        {
          name: "create_ticket",
          args: ticketArgs,
          result: { ticketId: 42, status: "created" },
        },
      ],
    });
    // The model's call is echoed back unchanged (thought signature included),
    // followed by the tool's result.
    expect(requests[1].contents).toEqual([
      { role: "user", parts: [{ text: "I was charged but have no order!" }] },
      { role: "model", parts: [callPart] },
      {
        role: "user",
        parts: [
          {
            functionResponse: {
              id: "call-1",
              name: "create_ticket",
              response: { output: { ticketId: 42, status: "created" } },
            },
          },
        ],
      },
    ]);
  });

  it("reports a failed tool to the model so it can explain instead of crashing the turn", async () => {
    const { ai, requests } = fakeGemini(
      modelReply({
        functionCall: { name: "create_ticket", args: { category: "billing" } },
      }),
      modelReply({ text: "Sorry, I couldn't open a ticket just now." }),
    );

    const result = await runConversation({
      ai,
      systemInstruction: "You are a support assistant.",
      tools: [CREATE_TICKET_TOOL],
      history: [{ role: "user", text: "I need a human" }],
      onToolCall: async () => {
        throw new Error('create_ticket: "subject" is required');
      },
    });

    expect(result.text).toBe("Sorry, I couldn't open a ticket just now.");
    expect(result.toolCalls).toEqual([
      {
        name: "create_ticket",
        args: { category: "billing" },
        result: { error: 'create_ticket: "subject" is required' },
      },
    ]);
    expect(requests[1].contents).toEqual([
      expect.anything(),
      expect.anything(),
      {
        role: "user",
        parts: [
          {
            functionResponse: {
              name: "create_ticket",
              response: { error: 'create_ticket: "subject" is required' },
            },
          },
        ],
      },
    ]);
  });

  it("gives up when the model keeps calling tools without answering", async () => {
    const call = (): GenerateContentResponse =>
      modelReply({ functionCall: { name: "create_ticket", args: {} } });
    const { ai, requests } = fakeGemini(call(), call(), call(), call());

    await expect(
      runConversation({
        ai,
        systemInstruction: "You are a support assistant.",
        tools: [CREATE_TICKET_TOOL],
        history: [{ role: "user", text: "Help" }],
        onToolCall: async () => ({ status: "created" }),
        maxToolRounds: 3,
      }),
    ).rejects.toThrow(/tool/i);
    expect(requests).toHaveLength(4);
  });
});

describe("parseCreateTicketArgs", () => {
  const valid = {
    subject: "  Refund not received  ",
    category: "refund",
    priority: "medium",
    escalationReason: "Refund approved 10 days ago but not credited.",
  };

  it("accepts well-formed arguments and trims the text fields", () => {
    expect(parseCreateTicketArgs(valid)).toEqual({
      subject: "Refund not received",
      category: "refund",
      priority: "medium",
      escalationReason: "Refund approved 10 days ago but not credited.",
    });
  });

  it("rejects a category or priority outside the allowed values", () => {
    expect(() =>
      parseCreateTicketArgs({ ...valid, category: "billing" }),
    ).toThrow(/category/);
    expect(() =>
      parseCreateTicketArgs({ ...valid, priority: "urgent" }),
    ).toThrow(/priority/);
  });

  it("rejects missing or blank text fields", () => {
    expect(() => parseCreateTicketArgs({ ...valid, subject: "   " })).toThrow(
      /subject/,
    );
    expect(() =>
      parseCreateTicketArgs({ ...valid, escalationReason: undefined }),
    ).toThrow(/escalationReason/);
  });

  it("cuts an over-long subject to the 255 characters the tickets table holds", () => {
    const parsed = parseCreateTicketArgs({
      ...valid,
      subject: "x".repeat(300),
    });
    expect(parsed.subject).toHaveLength(255);
  });
});
