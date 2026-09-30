import type { TicketCategory, TicketPriority, TicketStatus } from "@/db/schema";

// Display names for ticket fields, shared by the UI and by server code that
// writes them into messages.

const STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
};

const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export function statusLabel(status: TicketStatus): string {
  return STATUS_LABELS[status];
}

export function priorityLabel(priority: TicketPriority): string {
  return PRIORITY_LABELS[priority];
}

export function categoryLabel(category: TicketCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}
