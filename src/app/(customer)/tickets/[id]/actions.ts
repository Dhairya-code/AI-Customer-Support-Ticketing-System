"use server";

import { refresh } from "next/cache";
import { AuthError, requireRole } from "@/lib/session";
import {
  addCustomerReply,
  parseTicketId,
  type CustomerReplyResult,
} from "@/lib/tickets";

// Server Action arguments come straight from the client, so neither the types
// nor the ticket's ownership are taken on trust.
export async function replyToTicket(
  ticketId: number,
  content: string,
): Promise<CustomerReplyResult> {
  let customerId: string;
  try {
    ({ id: customerId } = await requireRole(["customer"]));
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, error: "Your session has ended. Sign in again to reply." };
    }
    throw error;
  }

  const id = parseTicketId(ticketId);
  if (id === null || typeof content !== "string") {
    return { ok: false, error: "This reply could not be sent." };
  }

  const result = await addCustomerReply({ customerId, ticketId: id, content });
  if (result.ok) refresh();
  return result;
}
