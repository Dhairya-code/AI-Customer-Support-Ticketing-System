import "server-only";
import { Resend } from "resend";
import type { TicketCategory, TicketPriority } from "@/db/schema";

// Every helper here is best-effort: it logs and returns false instead of
// throwing, so a failed email never fails or rolls back the ticket operation
// that triggered it.

interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

async function sendEmail(email: Email): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    console.warn(
      `Email "${email.subject}" not sent: RESEND_API_KEY and RESEND_FROM_EMAIL must be set`,
    );
    return false;
  }

  try {
    // Built per send (it only holds the key), so importing this module never
    // requires the key. The SDK reports API errors in its result, not by throwing.
    const { error } = await new Resend(apiKey).emails.send({ from, ...email });
    if (error) {
      console.error(`Email "${email.subject}" was rejected by Resend`, error);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`Email "${email.subject}" could not be sent`, error);
    return false;
  }
}

function appUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return new URL(path, base).toString();
}

// Customer names, ticket subjects and replies come from customers, agents or
// the model, so they are escaped before going into HTML.
function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;"); // attributes below are double-quoted
}

// Plain paragraphs become the text body, and escaped <p> tags the HTML body.
function layout(paragraphs: string[], link: { label: string; url: string }) {
  const text = [...paragraphs, `${link.label}: ${link.url}`].join("\n\n");
  const html = [
    ...paragraphs.map(
      (paragraph) =>
        `<p style="white-space:pre-line">${escapeHtml(paragraph)}</p>`,
    ),
    `<p><a href="${escapeHtml(link.url)}">${escapeHtml(link.label)}</a></p>`,
  ].join("\n");
  return { text, html };
}

export interface TicketCreatedEmail {
  to: string;
  customerName: string;
  ticketId: number;
  subject: string;
  reason: string;
}

// The customer's receipt for a ticket raised on their behalf.
export async function sendTicketCreatedEmail({
  to,
  customerName,
  ticketId,
  subject,
  reason,
}: TicketCreatedEmail): Promise<boolean> {
  return sendEmail({
    to,
    subject: `We've received your request [Ticket #${ticketId}]`,
    ...layout(
      [
        `Hi ${customerName},`,
        `We've opened support ticket #${ticketId} for you. A member of our support team will follow up soon.`,
        `Subject: ${subject}`,
        `Summary: ${reason}`,
      ],
      { label: "View your ticket", url: appUrl(`/tickets/${ticketId}`) },
    ),
  });
}

export interface AgentAlertEmail {
  ticketId: number;
  subject: string;
  priority: TicketPriority;
  category: TicketCategory;
}

// Alerts the support team inbox (SUPPORT_TEAM_EMAIL) to a new ticket.
export async function sendAgentAlertEmail({
  ticketId,
  subject,
  priority,
  category,
}: AgentAlertEmail): Promise<boolean> {
  const to = process.env.SUPPORT_TEAM_EMAIL;
  if (!to) {
    console.warn(`Agent alert for ticket #${ticketId} not sent: SUPPORT_TEAM_EMAIL is not set`);
    return false;
  }
  return sendEmail({
    to,
    subject: `[${priority.toUpperCase()}] New ticket #${ticketId}: ${subject}`,
    ...layout(
      [
        `A new ${priority}-priority ${category} ticket is waiting in the queue.`,
        `Subject: ${subject}`,
      ],
      { label: "Open the ticket", url: appUrl(`/admin/tickets/${ticketId}`) },
    ),
  });
}

export interface AgentReplyNotificationEmail {
  to: string;
  customerName: string;
  ticketId: number;
  replySnippet: string;
}

const SNIPPET_MAX_LENGTH = 500;

function toSnippet(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > SNIPPET_MAX_LENGTH
    ? `${trimmed.slice(0, SNIPPET_MAX_LENGTH - 1)}…`
    : trimmed;
}

// Tells the customer an agent posted a public reply on their ticket.
export async function sendAgentReplyNotificationEmail({
  to,
  customerName,
  ticketId,
  replySnippet,
}: AgentReplyNotificationEmail): Promise<boolean> {
  return sendEmail({
    to,
    subject: `New reply on your ticket #${ticketId}`,
    ...layout(
      [
        `Hi ${customerName},`,
        `Our support team replied to ticket #${ticketId}:`,
        toSnippet(replySnippet),
      ],
      { label: "Read and reply", url: appUrl(`/tickets/${ticketId}`) },
    ),
  });
}
