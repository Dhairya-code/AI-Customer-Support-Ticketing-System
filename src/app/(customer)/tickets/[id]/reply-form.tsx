"use client";

import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { MAX_MESSAGE_LENGTH } from "@/lib/chat";
import { replyToTicket } from "./actions";

export function ReplyForm({ ticketId }: { ticketId: number }) {
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sentOnce = useRef(false);

  function send() {
    if (!content.trim() || pending) return;
    sentOnce.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const result = await replyToTicket(ticketId, content);
        // On failure the draft stays in the box so nothing is lost.
        if (result.ok) setContent("");
        else setError(result.error);
      } catch {
        setError("Couldn't send your reply. Check your connection and try again.");
      }
    });
  }

  // The textarea is disabled while sending, which drops focus; hand it back
  // once the send settles (but don't grab focus on page load).
  useEffect(() => {
    if (!pending && sentOnce.current) inputRef.current?.focus();
  }, [pending]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    send();
  }

  // Enter sends; Shift+Enter starts a new line, as in the support chat.
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border-t bg-white p-4">
      {error && (
        <p
          role="alert"
          className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      <div className="flex items-end gap-3">
        <label htmlFor="reply-input" className="sr-only">
          Reply to support
        </label>
        <textarea
          ref={inputRef}
          id="reply-input"
          rows={1}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder="Write a reply to our support team..."
          disabled={pending}
          className="max-h-40 flex-1 resize-none rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-black outline-none field-sizing-content placeholder:text-gray-400 focus:border-black disabled:bg-gray-100"
        />
        <button
          type="submit"
          disabled={pending || !content.trim()}
          className="rounded-xl bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Sending..." : "Send"}
        </button>
      </div>
    </form>
  );
}
