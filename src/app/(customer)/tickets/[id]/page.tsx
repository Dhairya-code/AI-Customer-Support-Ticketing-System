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
import { requireCustomerPage } from "@/lib/session";
import {
  acceptsReplies,
  getCustomerTicketThread,
  parseTicketId,
  type CustomerThreadMessage,
} from "@/lib/tickets";
import { ReplyForm } from "./reply-form";

export async function generateMetadata({
  params,
}: PageProps<"/tickets/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Ticket #${id} | AI Customer Support` };
}

export default async function TicketThreadPage({
  params,
}: PageProps<"/tickets/[id]">) {
  const user = await requireCustomerPage();
  const ticketId = parseTicketId((await params).id);
  // Another customer's ticket is a 404 too, so ids reveal nothing.
  const thread = ticketId && (await getCustomerTicketThread(user.id, ticketId));
  if (!thread) notFound();
  const { ticket, messages } = thread;

  return (
    <main className="flex-1 bg-gray-100 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/tickets"
          className="text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          ← My tickets
        </Link>

        <div className="mt-4 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200">
          <header className="border-b p-5">
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
                <LocalDate date={ticket.createdAt} prefix="Opened " />
              </span>
            </div>
          </header>

          <section
            aria-label="Conversation"
            aria-live="polite"
            className="space-y-4 bg-gray-50 p-5"
          >
            {messages.length === 0 ? (
              <p className="text-center text-sm text-gray-500">No messages yet.</p>
            ) : (
              messages.map((message) => (
                <ThreadMessage key={message.id} message={message} />
              ))
            )}
          </section>

          {acceptsReplies(ticket.status) ? (
            <ReplyForm ticketId={ticket.id} />
          ) : (
            <p className="border-t bg-white p-4 text-center text-sm text-gray-600">
              This ticket is closed, so it no longer accepts replies. Need more
              help?{" "}
              <Link href="/" className="font-medium text-gray-900 underline">
                Start a new chat
              </Link>
              .
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

// System messages render as centred notes rather than bubbles.
const SENDERS: Record<
  Exclude<SenderType, "system">,
  { label: string; bubble: string }
> = {
  customer: { label: "You", bubble: "rounded-br-md bg-black text-white" },
  ai: {
    label: "AI assistant",
    bubble: "rounded-bl-md bg-white text-gray-800 shadow-sm",
  },
  agent: {
    label: "Support agent",
    bubble: "rounded-bl-md bg-indigo-50 text-indigo-950 ring-1 ring-indigo-200",
  },
};

function ThreadMessage({ message }: { message: CustomerThreadMessage }) {
  if (message.senderType === "system") {
    return (
      <p className="text-center text-xs text-gray-500">{message.content}</p>
    );
  }

  const fromCustomer = message.senderType === "customer";
  const { label, bubble } = SENDERS[message.senderType];

  return (
    <div className={`flex flex-col ${fromCustomer ? "items-end" : "items-start"}`}>
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
