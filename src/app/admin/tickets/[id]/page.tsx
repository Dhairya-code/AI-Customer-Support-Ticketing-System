import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LocalDate } from "@/components/local-date";
import {
  CategoryPill,
  PriorityIndicator,
  StatusBadge,
} from "@/components/tickets/ticket-badges";
import type { SenderType } from "@/db/schema";
import { requireStaffPage } from "@/lib/session";
import {
  getStaffTicketDetail,
  type StaffThreadMessage,
  type StaffTicket,
  type StaffTicketCustomer,
} from "@/lib/staff-tickets";
import { parseTicketId } from "@/lib/tickets";

export async function generateMetadata({
  params,
}: PageProps<"/admin/tickets/[id]">): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Ticket #${id} | Staff dashboard`,
    robots: { index: false, follow: false },
  };
}

export default async function StaffTicketPage({
  params,
}: PageProps<"/admin/tickets/[id]">) {
  await requireStaffPage();
  const ticketId = parseTicketId((await params).id);
  const detail = ticketId && (await getStaffTicketDetail(ticketId));
  if (!detail) notFound();
  const { ticket, customer, messages } = detail;

  return (
    <main className="flex-1 bg-gray-100 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/admin"
          className="text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          ← Back to dashboard
        </Link>

        <TicketSummary ticket={ticket} />

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_18rem]">
          <section
            aria-label="Conversation"
            className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200"
          >
            <h2 className="text-lg font-semibold text-gray-900">Conversation</h2>
            {messages.length === 0 ? (
              <p className="text-center text-sm text-gray-500">No messages yet.</p>
            ) : (
              messages.map((message) => (
                <TranscriptMessage
                  key={message.id}
                  message={message}
                  customerName={customer.name}
                />
              ))
            )}
          </section>

          <CustomerProfile customer={customer} />
        </div>
      </div>
    </main>
  );
}

function TicketSummary({ ticket }: { ticket: StaffTicket }) {
  return (
    <header className="mt-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500">Ticket #{ticket.id}</p>
          <h1 className="mt-0.5 text-xl font-bold wrap-break-word text-gray-900">
            {ticket.subject}
          </h1>
        </div>
        <StatusBadge status={ticket.status} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <CategoryPill category={ticket.category} />
        <PriorityIndicator priority={ticket.priority} />
        <span className="text-xs text-gray-500">
          <LocalDate date={ticket.createdAt} prefix="Opened " withTime />
        </span>
        <span className="text-xs text-gray-500">
          <LocalDate date={ticket.updatedAt} prefix="Updated " withTime />
        </span>
      </div>
      <div className="mt-4 rounded-xl bg-gray-50 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Escalation reason
        </h2>
        <p className="mt-1 whitespace-pre-wrap wrap-break-word text-sm text-gray-800">
          {ticket.escalationReason ?? "No reason was recorded."}
        </p>
      </div>
    </header>
  );
}

function CustomerProfile({ customer }: { customer: StaffTicketCustomer }) {
  return (
    <aside
      aria-label="Customer"
      className="h-fit rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200"
    >
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Customer
      </h2>
      <p className="mt-2 font-semibold wrap-break-word text-gray-900">{customer.name}</p>
      <a
        href={`mailto:${customer.email}`}
        className="text-sm break-all text-gray-600 hover:text-gray-900 hover:underline"
      >
        {customer.email}
      </a>
      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="text-gray-500">Registered</dt>
          <dd className="font-medium text-gray-900">
            <LocalDate date={customer.createdAt} />
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">Previous tickets</dt>
          <dd className="font-medium text-gray-900">
            {customer.previousTicketCount}
          </dd>
        </div>
      </dl>
    </aside>
  );
}

// System messages render as centred notes rather than bubbles.
const BUBBLES: Record<Exclude<SenderType, "system">, string> = {
  customer: "rounded-bl-md bg-gray-100 text-gray-900",
  ai: "rounded-br-md bg-white text-gray-800 ring-1 ring-gray-200",
  agent: "rounded-br-md bg-indigo-50 text-indigo-950 ring-1 ring-indigo-200",
};

// Internal notes stand out so an agent never mistakes one for something the
// customer saw.
const INTERNAL_NOTE_BUBBLE =
  "rounded-br-md bg-amber-50 text-amber-950 ring-1 ring-amber-200";

function senderLabel(message: StaffThreadMessage, customerName: string): string {
  const agentName = message.senderName ?? "Support agent";
  if (message.isInternal) return `Internal note · ${agentName}`;
  if (message.senderType === "customer") return customerName;
  if (message.senderType === "ai") return "AI assistant";
  return agentName;
}

// From the agent's side the customer is the other party, so their messages
// sit on the left and replies from our side (AI and agents) on the right.
function TranscriptMessage({
  message,
  customerName,
}: {
  message: StaffThreadMessage;
  customerName: string;
}) {
  if (message.senderType === "system") {
    return (
      <p className="text-center text-xs text-gray-500">{message.content}</p>
    );
  }

  const fromCustomer = message.senderType === "customer";
  const label = senderLabel(message, customerName);
  const bubble = message.isInternal
    ? INTERNAL_NOTE_BUBBLE
    : BUBBLES[message.senderType];

  return (
    <div className={`flex flex-col ${fromCustomer ? "items-start" : "items-end"}`}>
      <p className="mb-1 flex items-center gap-2 px-1 text-xs text-gray-500">
        <span className="font-medium text-gray-700">{label}</span>
        <LocalDate date={message.createdAt} withTime />
      </p>
      <div
        className={`max-w-[85%] whitespace-pre-wrap wrap-break-word rounded-2xl px-4 py-3 text-sm sm:max-w-[75%] ${bubble}`}
      >
        {message.content}
      </div>
    </div>
  );
}
