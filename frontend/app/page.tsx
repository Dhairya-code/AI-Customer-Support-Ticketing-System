"use client";

import { FormEvent, useState } from "react";

type Message = {
  id: number;
  sender: "user" | "assistant";
  text: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      sender: "assistant",
      text: "Hi! 👋 I'm your AI support assistant. How can I help you today?",
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendMessage(event: FormEvent) {
    event.preventDefault();

    const text = input.trim();

    if (!text || loading) return;

    const userMessage: Message = {
      id: Date.now(),
      sender: "user",
      text,
    };

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/tickets",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            customer_name: "Guest Customer",
            customer_email: "guest@example.com",
            subject: "Customer Support Request",
            message: text,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to create ticket");
      }

      const ticket = await response.json();

      const assistantMessage: Message = {
        id: Date.now() + 1,
        sender: "assistant",
        text: `I've created support ticket #${ticket.id} for you. 🎫 A support agent can now review your request.`,
      };

      setMessages((current) => [...current, assistantMessage]);
    } catch (error) {
      console.error(error);

      const errorMessage: Message = {
        id: Date.now() + 1,
        sender: "assistant",
        text: "Sorry, I couldn't create your support ticket right now. Please make sure the backend server is running.",
      };

      setMessages((current) => [...current, errorMessage]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <div className="flex h-[700px] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <header className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              AI Support
            </h1>

            <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
              <span className="h-2 w-2 rounded-full bg-green-500"></span>
              Online
            </div>
          </div>

          <div className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600">
            Support Assistant
          </div>
        </header>

        {/* Chat */}
        <section className="flex-1 space-y-4 overflow-y-auto bg-gray-50 p-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.sender === "user"
                  ? "justify-end"
                  : "justify-start"
              }`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${
                  message.sender === "user"
                    ? "rounded-br-md bg-black text-white"
                    : "rounded-bl-md bg-white text-gray-800 shadow-sm"
                }`}
              >
                {message.text}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-md bg-white px-4 py-3 text-sm text-gray-500 shadow-sm">
                Creating your support ticket... ⏳
              </div>
            </div>
          )}
        </section>

        {/* Input */}
        <form
          onSubmit={sendMessage}
          className="border-t bg-white p-4"
        >
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Describe your problem..."
              disabled={loading}
              className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-black outline-none placeholder:text-gray-400 focus:border-black disabled:bg-gray-100"
            />

            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}