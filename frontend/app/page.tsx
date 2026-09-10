"use client";

import { FormEvent, useState } from "react";

export default function Home() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setResult("");

    try {
      const response = await fetch("http://127.0.0.1:8000/tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_name: name,
          customer_email: email,
          subject,
          message,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create ticket");
      }

      const data = await response.json();

      setResult(`Ticket #${data.id} created successfully.`);

      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch (error) {
      console.error(error);
      setResult("Failed to create ticket.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-100 px-6 py-12">
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-3xl font-bold text-gray-900">
          Customer Support
        </h1>

        <p className="mt-2 mb-8 text-gray-600">
          Tell us about your problem and our support team will help you.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block font-medium">
              Name
            </label>

            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Your name"
              className="w-full rounded-lg border border-gray-300 p-3 outline-none focus:border-black"
            />
          </div>

          <div>
            <label className="mb-2 block font-medium">
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full rounded-lg border border-gray-300 p-3 outline-none focus:border-black"
            />
          </div>

          <div>
            <label className="mb-2 block font-medium">
              Subject
            </label>

            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              placeholder="What is the issue?"
              className="w-full rounded-lg border border-gray-300 p-3 outline-none focus:border-black"
            />
          </div>

          <div>
            <label className="mb-2 block font-medium">
              Message
            </label>

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={6}
              placeholder="Describe your problem..."
              className="w-full rounded-lg border border-gray-300 p-3 outline-none focus:border-black"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-black px-4 py-3 font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Submit Ticket"}
          </button>
        </form>

        {result && (
          <div className="mt-6 rounded-lg bg-gray-100 p-4 font-medium">
            {result}
          </div>
        )}
      </div>
    </main>
  );
}