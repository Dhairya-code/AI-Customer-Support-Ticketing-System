"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { sendAgentReplyNotificationEmail } from "@/lib/email";
import { AuthError, requireRole } from "@/lib/session";
import { STAFF_ROLES } from "@/lib/staff-auth";
import {
  STAFF_MESSAGE_KINDS,
  addStaffMessage,
  type StaffMessageKind,
} from "@/lib/staff-tickets";
import { parseTicketId } from "@/lib/tickets";

export type PostStaffMessageResult = { ok: true } | { ok: false; error: string };

// Server Action arguments come straight from the client, so none of them are
// taken on trust.
export async function postStaffMessage(
  ticketId: number,
  content: string,
  kind: StaffMessageKind,
): Promise<PostStaffMessageResult> {
  let agentId: string;
  try {
    ({ id: agentId } = await requireRole(STAFF_ROLES));
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, error: "Your session has ended. Sign in again to post." };
    }
    throw error;
  }

  const id = parseTicketId(ticketId);
  if (
    id === null ||
    typeof content !== "string" ||
    !(STAFF_MESSAGE_KINDS as readonly unknown[]).includes(kind)
  ) {
    return { ok: false, error: "This message could not be posted." };
  }

  const result = await addStaffMessage({ agentId, ticketId: id, content, kind });
  if (!result.ok) return result;

  // Sent after the response so email never delays the agent. The helper logs
  // its own failures and never throws.
  if (kind === "reply") {
    const { customer } = result;
    after(() =>
      sendAgentReplyNotificationEmail({
        to: customer.email,
        customerName: customer.name,
        ticketId: id,
        replySnippet: content,
      }),
    );
  }
  refresh();
  return { ok: true };
}
