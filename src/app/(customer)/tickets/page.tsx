import type { Metadata } from "next";
import Link from "next/link";
import { LocalDate } from "@/components/local-date";
import {
  CategoryPill,
  PriorityIndicator,
  StatusBadge,
} from "@/components/tickets/ticket-badges";
import { requireCustomerPage } from "@/lib/session";
import { listCustomerTickets, type CustomerTicketSummary } from "@/lib/tickets";

export const metadata: Metadata = { title: "My tickets" };

export default async function MyTicketsPage() {
  const user = await requireCustomerPage();
  const tickets = await listCustomerTickets(user.id);

  return (
    <main className="flex-1 bg-gray-100 px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My tickets</h1>
            <p className="mt-1 text-sm text-gray-600">
              Support requests opened from your chats with our assistant.
            </p>
          </div>
          <Link
            href="/"
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Chat with support
          </Link>
        </div>

        {tickets.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="space-y-3">
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <TicketCard ticket={ticket} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function TicketCard({ ticket }: { ticket: CustomerTicketSummary }) {
  return (
    <Link
      href={`/tickets/${ticket.id}`}
      className="block rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 transition hover:shadow-md hover:ring-gray-300"
    >
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500">Ticket #{ticket.id}</p>
          <h2 className="mt-0.5 truncate font-semibold text-gray-900">
            {ticket.subject}
          </h2>
        </div>
        <StatusBadge status={ticket.status} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <CategoryPill category={ticket.category} />
        <PriorityIndicator priority={ticket.priority} />
        <span className="text-xs text-gray-500">
          <LocalDate date={ticket.createdAt} prefix="Opened " />
        </span>
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl bg-white px-6 py-16 text-center shadow-sm ring-1 ring-gray-200">
      <h2 className="text-lg font-semibold text-gray-900">
        No support tickets found
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-gray-600">
        Our AI assistant answers most questions straight away, and opens a
        ticket for you when a human needs to step in.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
      >
        Start a chat
      </Link>
    </div>
  );
}
