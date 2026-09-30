import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import {
  SENDER_TYPES,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  USER_ROLES,
} from "./enums";

export {
  SENDER_TYPES,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  USER_ROLES,
} from "./enums";

// Better Auth core tables. Table and column names follow Better Auth's defaults
// so the Drizzle adapter needs no field mapping.

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  role: varchar("role", { length: 20, enum: USER_ROLES })
    .default("customer")
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

// Support domain tables.

export const tickets = pgTable(
  "tickets",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    subject: varchar("subject", { length: 255 }).notNull(),
    category: varchar("category", { length: 50, enum: TICKET_CATEGORIES })
      .default("other")
      .notNull(),
    priority: varchar("priority", { length: 20, enum: TICKET_PRIORITIES })
      .default("medium")
      .notNull(),
    status: varchar("status", { length: 30, enum: TICKET_STATUSES })
      .default("open")
      .notNull(),
    escalationReason: text("escalation_reason"),
    assignedToId: text("assigned_to_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("tickets_user_id_idx").on(table.userId),
    index("tickets_assigned_to_id_idx").on(table.assignedToId),
    index("tickets_status_idx").on(table.status),
  ],
);

// ticketId is nullable: chat messages exist before escalation and are linked
// to a ticket when the AI creates one. senderId is null for AI/system messages.
export const messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    ticketId: integer("ticket_id").references(() => tickets.id, {
      onDelete: "cascade",
    }),
    senderId: text("sender_id").references(() => user.id, {
      onDelete: "set null",
    }),
    senderType: varchar("sender_type", { length: 20, enum: SENDER_TYPES })
      .notNull(),
    content: text("content").notNull(),
    isInternal: boolean("is_internal").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("messages_ticket_id_idx").on(table.ticketId)],
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  tickets: many(tickets, { relationName: "ticketCustomer" }),
  assignedTickets: many(tickets, { relationName: "ticketAssignee" }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const ticketsRelations = relations(tickets, ({ one, many }) => ({
  customer: one(user, {
    fields: [tickets.userId],
    references: [user.id],
    relationName: "ticketCustomer",
  }),
  assignedTo: one(user, {
    fields: [tickets.assignedToId],
    references: [user.id],
    relationName: "ticketAssignee",
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  ticket: one(tickets, {
    fields: [messages.ticketId],
    references: [tickets.id],
  }),
  sender: one(user, { fields: [messages.senderId], references: [user.id] }),
}));

export type User = typeof user.$inferSelect;
export type UserRole = (typeof USER_ROLES)[number];
export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type SenderType = (typeof SENDER_TYPES)[number];
