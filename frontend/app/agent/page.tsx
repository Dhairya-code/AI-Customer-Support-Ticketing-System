"use client";

import { useEffect, useMemo, useState } from "react";

type Ticket = {
  id: number;
  customer_name: string;
  customer_email: string;
  subject: string;
  message: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
};

export default function AgentDashboard() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadTickets() {
      try {
        const response = await fetch(
          "http://127.0.0.1:8000/tickets"
        );

        if (!response.ok) {
          throw new Error("Failed to load tickets");
        }

        const data: Ticket[] = await response.json();
        setTickets(data);
      } catch (err) {
        console.error(err);
        setError("Could not load tickets.");
      } finally {
        setLoading(false);
      }
    }

    loadTickets();
  }, []);

  const stats = useMemo(() => ({
    total: tickets.length,
    open: tickets.filter((t) => t.status === "Open").length,
    high: tickets.filter((t) => t.priority === "High").length,
    resolved: tickets.filter((t) => t.status === "Resolved").length,
  }), [tickets]);

  return (
    <main className="min-h-screen bg-gray-100 px-6 py-10">
      <div className="mx-auto max-w-7xl">

        <h1 className="text-3xl font-bold text-gray-900">
          Support Dashboard
        </h1>

        <p className="mt-2 mb-8 text-gray-600">
          Manage and monitor customer support tickets.
        </p>

        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <StatCard title="Total Tickets" value={stats.total} />
          <StatCard title="Open" value={stats.open} />
          <StatCard title="High Priority" value={stats.high} />
          <StatCard title="Resolved" value={stats.resolved} />
        </div>

        <div className="overflow-hidden rounded-xl bg-white shadow">

          <div className="border-b p-6">
            <h2 className="text-xl font-semibold">
              Tickets
            </h2>
          </div>

          {loading && (
            <div className="p-6 text-gray-500">
              Loading tickets...
            </div>
          )}

          {error && (
            <div className="p-6 text-red-600">
              {error}
            </div>
          )}

          {!loading && !error && tickets.length === 0 && (
            <div className="p-6 text-gray-500">
              No tickets found.
            </div>
          )}

          {!loading && !error && tickets.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-sm text-gray-600">
                  <tr>
                    <th className="px-6 py-4">ID</th>
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4">Subject</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Priority</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {tickets.map((ticket) => (
                    <tr
                      key={ticket.id}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-6 py-4 font-medium">
                        #{ticket.id}
                      </td>

                      <td className="px-6 py-4">
                        <div className="font-medium">
                          {ticket.customer_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {ticket.customer_email}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {ticket.subject}
                      </td>

                      <td className="px-6 py-4">
                        {ticket.category}
                      </td>

                      <td className="px-6 py-4">
                        {ticket.priority}
                      </td>

                      <td className="px-6 py-4">
                        {ticket.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function StatCard({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div className="rounded-xl bg-white p-6 shadow">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}