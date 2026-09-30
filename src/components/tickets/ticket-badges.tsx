import type { TicketCategory, TicketPriority, TicketStatus } from "@/db/schema";
import { priorityLabel, statusLabel } from "@/lib/ticket-labels";

const STATUS_STYLES: Record<TicketStatus, string> = {
  open: "bg-blue-50 text-blue-700 ring-blue-200",
  in_progress: "bg-amber-50 text-amber-800 ring-amber-200",
  resolved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  closed: "bg-gray-100 text-gray-600 ring-gray-200",
};

const PRIORITY_DOTS: Record<TicketPriority, string> = {
  low: "bg-gray-400",
  medium: "bg-blue-500",
  high: "bg-orange-500",
  critical: "bg-red-600",
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      <span className="sr-only">Status: </span>
      {statusLabel(status)}
    </span>
  );
}

export function PriorityIndicator({ priority }: { priority: TicketPriority }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700">
      <span aria-hidden className={`h-2 w-2 rounded-full ${PRIORITY_DOTS[priority]}`} />
      {priorityLabel(priority)}
      <span className="sr-only"> priority</span>
    </span>
  );
}

export function CategoryPill({ category }: { category: TicketCategory }) {
  return (
    <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium capitalize text-gray-700">
      {category}
    </span>
  );
}
