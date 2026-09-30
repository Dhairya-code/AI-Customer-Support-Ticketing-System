import type { CreateEmailOptions, CreateEmailResponse } from "resend";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.hoisted(() =>
  vi.fn<(payload: CreateEmailOptions) => Promise<CreateEmailResponse>>(),
);

// Resend is mocked at the SDK boundary so no test sends real email.
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

const {
  sendAgentAlertEmail,
  sendAgentReplyNotificationEmail,
  sendTicketCreatedEmail,
} = await import("./email");

function sent(): CreateEmailResponse {
  return { data: { id: "email-1" }, error: null, headers: null };
}

function lastEmail() {
  const [payload] = send.mock.calls.at(-1)!;
  return payload as CreateEmailOptions & { html: string; text: string };
}

beforeEach(() => {
  send.mockReset();
  send.mockResolvedValue(sent());
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("RESEND_FROM_EMAIL", "support@example.com");
  vi.stubEnv("SUPPORT_TEAM_EMAIL", "team@example.com");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://help.example.com");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("sendTicketCreatedEmail", () => {
  const receipt = {
    to: "casey@example.com",
    customerName: "Casey",
    ticketId: 42,
    subject: "Charged twice for order #1001",
    reason: "Customer was charged twice and wants the duplicate refunded.",
  };

  it("sends the customer a receipt with the ticket id, summary and a link to the ticket", async () => {
    expect(await sendTicketCreatedEmail(receipt)).toBe(true);

    expect(send).toHaveBeenCalledOnce();
    const email = lastEmail();
    expect(email.from).toBe("support@example.com");
    expect(email.to).toBe("casey@example.com");
    expect(email.subject).toContain("#42");
    for (const body of [email.text, email.html]) {
      expect(body).toContain("Casey");
      expect(body).toContain(receipt.subject);
      expect(body).toContain(receipt.reason);
      expect(body).toContain("https://help.example.com/tickets/42");
    }
  });

  it("escapes customer and model text in the HTML body", async () => {
    await sendTicketCreatedEmail({
      ...receipt,
      customerName: "<b>Casey</b>",
      subject: `<img src=x onerror="alert(1)">`,
    });

    const { html } = lastEmail();
    expect(html).not.toContain("<b>Casey</b>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;b&gt;Casey&lt;/b&gt;");
  });
});

describe("sendAgentAlertEmail", () => {
  it("alerts the support team to the new ticket with a link to the agent view", async () => {
    expect(
      await sendAgentAlertEmail({
        ticketId: 42,
        subject: "Charged twice for order #1001",
        priority: "high",
        category: "payment",
      }),
    ).toBe(true);

    const email = lastEmail();
    expect(email.from).toBe("support@example.com");
    expect(email.to).toBe("team@example.com");
    expect(email.subject).toContain("#42");
    expect(email.subject).toMatch(/high/i);
    for (const body of [email.text, email.html]) {
      expect(body).toContain("Charged twice for order #1001");
      expect(body).toContain("payment");
      expect(body).toContain("https://help.example.com/admin/tickets/42");
    }
  });

  it("skips the alert, with a warning, when no support team address is configured", async () => {
    vi.stubEnv("SUPPORT_TEAM_EMAIL", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(
      await sendAgentAlertEmail({
        ticketId: 42,
        subject: "Help",
        priority: "low",
        category: "other",
      }),
    ).toBe(false);

    expect(send).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });
});

describe("sendAgentReplyNotificationEmail", () => {
  it("tells the customer an agent replied, with a snippet and a link to the ticket", async () => {
    expect(
      await sendAgentReplyNotificationEmail({
        to: "casey@example.com",
        customerName: "Casey",
        ticketId: 42,
        replySnippet: "We've refunded the duplicate charge.",
      }),
    ).toBe(true);

    const email = lastEmail();
    expect(email.to).toBe("casey@example.com");
    expect(email.subject).toContain("#42");
    for (const body of [email.text, email.html]) {
      expect(body).toContain("Casey");
      expect(body).toContain("We've refunded the duplicate charge.");
      expect(body).toContain("https://help.example.com/tickets/42");
    }
  });

  it("shortens a long reply to a snippet", async () => {
    await sendAgentReplyNotificationEmail({
      to: "casey@example.com",
      customerName: "Casey",
      ticketId: 42,
      replySnippet: "x".repeat(1000),
    });

    expect(lastEmail().text).not.toContain("x".repeat(501));
  });
});

describe("email failures", () => {
  const reply = {
    to: "casey@example.com",
    customerName: "Casey",
    ticketId: 42,
    replySnippet: "Done.",
  };

  it("returns false and logs when Resend rejects the email", async () => {
    send.mockResolvedValue({
      data: null,
      error: {
        name: "validation_error",
        message: "Invalid `to` field",
        statusCode: 422,
      },
      headers: null,
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await sendAgentReplyNotificationEmail(reply)).toBe(false);
    expect(error).toHaveBeenCalled();
  });

  it("returns false and logs when the request to Resend throws", async () => {
    send.mockRejectedValue(new Error("fetch failed"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await sendAgentReplyNotificationEmail(reply)).toBe(false);
    expect(error).toHaveBeenCalled();
  });

  it.each(["RESEND_API_KEY", "RESEND_FROM_EMAIL"])(
    "skips sending, with a warning, when %s is not set",
    async (name) => {
      vi.stubEnv(name, "");
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

      expect(await sendAgentReplyNotificationEmail(reply)).toBe(false);
      expect(send).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalled();
    },
  );
});
