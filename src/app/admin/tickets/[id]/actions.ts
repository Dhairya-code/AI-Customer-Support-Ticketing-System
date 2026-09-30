"use server";

import { refresh, revalidatePath } from "next/cache";
import { after } from "next/server";
import { TICKET_STATUSES, type TicketStatus } from "@/db/schema";
import type { SessionUser } from "@/lib/auth";
import { sendAgentReplyNotificationEmail } from "@/lib/email";
import { AuthError, requireRole } from "@/lib/session";
import { STAFF_ROLES } from "@/lib/staff-auth";
import {
  STAFF_MESSAGE_KINDS,
  addStaffMessage,
  isOneOf,
  parseTicketTriage,
  setTicketStatus,
  updateTicketTriage,
  type StaffActionResult,
  type StaffMessageKind,
  type TicketTriage,
} from "@/lib/staff-tickets";
import { parseTicketId } from "@/lib/tickets";

const SESSION_ENDED = { ok: false, error: "Your session has ended. Sign in again." } as const;

// Status, priority and category all show on the dashboard, so it is purged
// from the client cache as well as the ticket page being refreshed.
function refreshTicketViews(): void {
  revalidatePath("/admin");
  refresh();
}

// The signed-in staff member, or null when the session is gone or not staff.
async function currentStaff(): Promise<SessionUser | null> {
  try {
    return await requireRole(STAFF_ROLES);
  } catch (error) {
    if (error instanceof AuthError) return null;
    throw error;
  }
}

// Server Action arguments come straight from the client, so none of them are
// taken on trust.

export async function postStaffMessage(
  ticketId: number,
  content: string,
  kind: StaffMessageKind,
): Promise<StaffActionResult> {
  const staff = await currentStaff();
  if (!staff) return SESSION_ENDED;

  const id = parseTicketId(ticketId);
  if (
    id === null ||
    typeof content !== "string" ||
    !isOneOf(STAFF_MESSAGE_KINDS, kind)
  ) {
    return { ok: false, error: "This message could not be posted." };
  }

  const result = await addStaffMessage({ agentId: staff.id, ticketId: id, content, kind });
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

export async function changeTicketStatus(
  ticketId: number,
  status: TicketStatus,
): Promise<StaffActionResult> {
  const staff = await currentStaff();
  if (!staff) return SESSION_ENDED;

  const id = parseTicketId(ticketId);
  if (id === null || !isOneOf(TICKET_STATUSES, status)) {
    return { ok: false, error: "This status change could not be made." };
  }

  const result = await setTicketStatus({ agent: staff, ticketId: id, status });
  if (result.ok) refreshTicketViews();
  return result;
}

export async function triageTicket(
  ticketId: number,
  changes: TicketTriage,
): Promise<StaffActionResult> {
  const staff = await currentStaff();
  if (!staff) return SESSION_ENDED;

  const id = parseTicketId(ticketId);
  const triage = parseTicketTriage(changes);
  if (id === null || triage === null) {
    return { ok: false, error: "This change could not be saved." };
  }

  const result = await updateTicketTriage(id, triage);
  if (result.ok) refreshTicketViews();
  return result;
}
