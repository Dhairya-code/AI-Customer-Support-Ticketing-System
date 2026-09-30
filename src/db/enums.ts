// The allowed values of the schema's enum columns. Kept free of Drizzle so
// client components can import them without pulling in the table definitions.

export const USER_ROLES = ["customer", "agent", "admin"] as const;
export const TICKET_CATEGORIES = [
  "payment",
  "order",
  "delivery",
  "account",
  "technical",
  "refund",
  "other",
] as const;
export const TICKET_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export const TICKET_STATUSES = [
  "open",
  "in_progress",
  "resolved",
  "closed",
] as const;
export const SENDER_TYPES = ["customer", "agent", "ai", "system"] as const;
