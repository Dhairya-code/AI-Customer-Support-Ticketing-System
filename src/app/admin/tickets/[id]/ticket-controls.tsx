"use client";

import { useState, useTransition } from "react";
import { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES } from "@/db/enums";
import type { TicketStatus } from "@/db/schema";
import type {
  StaffMember,
  StaffTicket,
  TicketTriage,
  StaffActionResult,
} from "@/lib/staff-tickets";
import { categoryLabel, priorityLabel, statusLabel } from "@/lib/ticket-labels";
import { changeTicketStatus, triageTicket } from "./actions";

const QUICK_ACTIONS: { status: TicketStatus; label: string; className: string }[] = [
  {
    status: "in_progress",
    label: "Mark In Progress",
    className: "bg-amber-50 text-amber-800 ring-amber-200 hover:bg-amber-100",
  },
  {
    status: "resolved",
    label: "Resolve Ticket",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100",
  },
  {
    status: "closed",
    label: "Close Ticket",
    className: "bg-gray-100 text-gray-700 ring-gray-300 hover:bg-gray-200",
  },
];

const SELECT_CLASS =
  "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-black disabled:bg-gray-100";

// Every control saves as soon as it is used; the page refreshes with the
// saved values, so the selects stay controlled by the server's copy.
export function TicketControls({
  ticket,
  staff,
}: {
  ticket: Pick<StaffTicket, "id" | "status" | "priority" | "category" | "assignedToId">;
  staff: StaffMember[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Closing is final; priority, category and assignee can still change.
  const closed = ticket.status === "closed";

  function save(update: () => Promise<StaffActionResult>) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await update();
        if (!result.ok) setError(result.error);
      } catch {
        setError("Couldn't save the change. Check your connection and try again.");
      }
    });
  }

  function setStatus(status: TicketStatus) {
    save(() => changeTicketStatus(ticket.id, status));
  }

  function setTriage(changes: TicketTriage) {
    save(() => triageTicket(ticket.id, changes));
  }

  return (
    <section
      aria-label="Manage ticket"
      aria-busy={pending}
      className="h-fit rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200"
    >
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Manage ticket
      </h2>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {closed ? (
        <p className="mt-3 text-xs text-gray-600">
          This ticket is closed, so its status can no longer change.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK_ACTIONS.filter(({ status }) => status !== ticket.status).map(
            ({ status, label, className }) => (
              <button
                key={status}
                type="button"
                disabled={pending}
                onClick={() => setStatus(status)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
              >
                {label}
              </button>
            ),
          )}
        </div>
      )}

      <div className="mt-4 space-y-3 text-sm">
        <label className="block">
          <span className="text-gray-500">Status</span>
          <select
            value={ticket.status}
            disabled={pending || closed}
            onChange={(event) => setStatus(event.target.value as TicketStatus)}
            className={SELECT_CLASS}
          >
            {TICKET_STATUSES.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-gray-500">Priority</span>
          <select
            value={ticket.priority}
            disabled={pending}
            onChange={(event) =>
              setTriage({ priority: event.target.value as TicketTriage["priority"] })
            }
            className={SELECT_CLASS}
          >
            {TICKET_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priorityLabel(priority)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-gray-500">Category</span>
          <select
            value={ticket.category}
            disabled={pending}
            onChange={(event) =>
              setTriage({ category: event.target.value as TicketTriage["category"] })
            }
            className={SELECT_CLASS}
          >
            {TICKET_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {categoryLabel(category)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-gray-500">Assigned to</span>
          <select
            value={ticket.assignedToId ?? ""}
            disabled={pending}
            onChange={(event) => setTriage({ assignedToId: event.target.value || null })}
            className={SELECT_CLASS}
          >
            <option value="">Unassigned</option>
            {staff.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
                {member.role === "admin" ? " (admin)" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
