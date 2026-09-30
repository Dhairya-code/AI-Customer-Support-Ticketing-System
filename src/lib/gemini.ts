import "server-only";
import {
  GoogleGenAI,
  Type,
  type Content,
  type FunctionDeclaration,
  type GenerateContentParameters,
  type GenerateContentResponse,
  type Part,
} from "@google/genai";
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  type TicketCategory,
  type TicketPriority,
} from "@/db/schema";

// Latest Flash model, available on the Gemini API free tier. GEMINI_MODEL can
// swap in another model (e.g. gemini-3.5-flash) when this one is overloaded.
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

export const CREATE_TICKET_TOOL: FunctionDeclaration = {
  name: "create_ticket",
  description:
    "Create a formal support ticket when an issue requires human assistance, payment resolution, refund approval, or user requests agent.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      subject: {
        type: Type.STRING,
        description: "Short summary of the customer's issue.",
      },
      category: { type: Type.STRING, enum: [...TICKET_CATEGORIES] },
      priority: { type: Type.STRING, enum: [...TICKET_PRIORITIES] },
      escalationReason: {
        type: Type.STRING,
        description: "Why this conversation needs a human agent.",
      },
    },
    required: ["subject", "category", "priority", "escalationReason"],
  },
};

export interface CreateTicketArgs {
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  escalationReason: string;
}

// Matches the varchar(255) subject column on the tickets table.
const SUBJECT_MAX_LENGTH = 255;

// The model's arguments are untrusted input: enums are declared in the tool
// schema, but nothing forces Gemini to stay within them.
export function parseCreateTicketArgs(
  args: Record<string, unknown>,
): CreateTicketArgs {
  return {
    subject: requireText(args, "subject").slice(0, SUBJECT_MAX_LENGTH),
    category: requireOneOf(args, "category", TICKET_CATEGORIES),
    priority: requireOneOf(args, "priority", TICKET_PRIORITIES),
    escalationReason: requireText(args, "escalationReason"),
  };
}

function requireText(args: Record<string, unknown>, field: string): string {
  const value = args[field];
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new Error(`create_ticket: "${field}" is required`);
  return text;
}

function requireOneOf<T extends string>(
  args: Record<string, unknown>,
  field: string,
  allowed: readonly T[],
): T {
  const value = args[field];
  if (!(allowed as readonly unknown[]).includes(value)) {
    throw new Error(
      `create_ticket: "${field}" must be one of ${allowed.join(", ")}`,
    );
  }
  return value as T;
}

let client: GoogleGenAI | undefined;

// Created on first use so importing this module never requires the key.
export function getGeminiClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    client = new GoogleGenAI({
      apiKey,
      // Flash models return 503 during demand spikes; retry briefly (408, 429
      // and 5xx) rather than failing the customer's chat turn.
      httpOptions: { retryOptions: { attempts: 3, maxDelay: 4 } },
    });
  }
  return client;
}

export interface ChatTurn {
  role: "user" | "model";
  text: string;
}

// The slice of the SDK client the runner uses, so tests can supply a fake.
export interface GeminiClient {
  models: {
    generateContent(
      params: GenerateContentParameters,
    ): Promise<GenerateContentResponse>;
  };
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export type ToolResult = Record<string, unknown>;

export interface RunConversationOptions {
  ai: GeminiClient;
  history: ChatTurn[];
  systemInstruction: string;
  tools: FunctionDeclaration[];
  // Executes a tool the model asked for; its result is sent back to the model.
  // A thrown error's message is sent back too, so keep it customer-safe.
  onToolCall: (call: ToolCall) => Promise<ToolResult>;
  // Bounds tool-call round trips so a looping model cannot run up requests.
  maxToolRounds?: number;
}

export interface ConversationResult {
  text: string;
  toolCalls: (ToolCall & { result: ToolResult })[];
}

export async function runConversation({
  ai,
  history,
  systemInstruction,
  tools,
  onToolCall,
  maxToolRounds = 3,
}: RunConversationOptions): Promise<ConversationResult> {
  const contents: Content[] = history.map((turn) => ({
    role: turn.role,
    parts: [{ text: turn.text }],
  }));
  const toolCalls: ConversationResult["toolCalls"] = [];

  for (let round = 0; ; round++) {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: { systemInstruction, tools: [{ functionDeclarations: tools }] },
    });

    const calls = response.functionCalls ?? [];
    if (calls.length === 0) {
      return { text: response.text ?? "", toolCalls };
    }
    if (round === maxToolRounds) {
      throw new Error(
        `Gemini was still calling tools after ${maxToolRounds} rounds`,
      );
    }

    // Echo the model's turn back verbatim: Gemini requires the thought
    // signatures on its function-call parts to be returned unchanged.
    const modelTurn = response.candidates?.[0]?.content;
    if (modelTurn) contents.push(modelTurn);

    const responseParts: Part[] = [];
    for (const call of calls) {
      const toolCall = { name: call.name ?? "", args: call.args ?? {} };
      let result: ToolResult;
      let response: ToolResult;
      try {
        result = await onToolCall(toolCall);
        response = { output: result };
      } catch (error) {
        // A failed tool goes back to the model as an error so it can tell the
        // customer, rather than crashing the whole chat turn.
        result = {
          error: error instanceof Error ? error.message : "Tool failed",
        };
        response = result;
      }
      toolCalls.push({ ...toolCall, result });
      responseParts.push({
        functionResponse: { id: call.id, name: toolCall.name, response },
      });
    }
    contents.push({ role: "user", parts: responseParts });
  }
}
