import type { TicketCategory, TicketPriority, TicketStatus } from "@/db/schema";

const STATUS_STYLES: Record<TicketStatus, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-blue-50 text-blue-700 ring-blue-200" },
  in_progress: {
    label: "In progress",
    className: "bg-amber-50 text-amber-800 ring-amber-200",
  },
  resolved: {
    label: "Resolved",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  closed: { label: "Closed", className: "bg-gray-100 text-gray-600 ring-gray-200" },
};

const PRIORITY_STYLES: Record<TicketPriority, { label: string; dot: string }> = {
  low: { label: "Low", dot: "bg-gray-400" },
  medium: { label: "Medium", dot: "bg-blue-500" },
  high: { label: "High", dot: "bg-orange-500" },
  critical: { label: "Critical", dot: "bg-red-600" },
};

export function statusLabel(status: TicketStatus): string {
  return STATUS_STYLES[status].label;
}

export function priorityLabel(priority: TicketPriority): string {
  return PRIORITY_STYLES[priority].label;
}

export function categoryLabel(category: TicketCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export function StatusBadge({ status }: { status: TicketStatus }) {
  const { label, className } = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}
    >
      <span className="sr-only">Status: </span>
      {label}
    </span>
  );
}

export function PriorityIndicator({ priority }: { priority: TicketPriority }) {
  const { label, dot } = PRIORITY_STYLES[priority];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700">
      <span aria-hidden className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
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
