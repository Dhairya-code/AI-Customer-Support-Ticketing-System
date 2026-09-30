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
import type { StaffMessageKind } from "@/lib/staff-tickets";
import { postStaffMessage } from "./actions";

const MODES: Record<
  StaffMessageKind,
  {
    tab: string;
    selectedTab: string;
    placeholder: string;
    submit: string;
    box: string;
    button: string;
  }
> = {
  reply: {
    tab: "Public Reply",
    selectedTab: "bg-black text-white",
    placeholder: "Reply to the customer. They'll also get an email...",
    submit: "Send reply",
    box: "bg-white",
    button: "bg-black hover:bg-gray-800",
  },
  note: {
    tab: "Internal Note",
    selectedTab: "bg-amber-600 text-white",
    placeholder: "Add a note for the support team. The customer won't see it...",
    submit: "Add note",
    box: "bg-amber-50",
    button: "bg-amber-600 hover:bg-amber-700",
  },
};

export function StaffReplyForm({
  ticketId,
  acceptsReplies,
}: {
  ticketId: number;
  // Closed tickets take internal notes only.
  acceptsReplies: boolean;
}) {
  const [chosenKind, setKind] = useState<StaffMessageKind>("reply");
  // The ticket can be closed while this page is open; notes are all that's left.
  const kind = acceptsReplies ? chosenKind : "note";
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sentOnce = useRef(false);
  const mode = MODES[kind];

  function send() {
    if (!content.trim() || pending) return;
    sentOnce.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const result = await postStaffMessage(ticketId, content, kind);
        // On failure the draft stays in the box so nothing is lost.
        if (result.ok) setContent("");
        else setError(result.error);
      } catch {
        setError("Couldn't post your message. Check your connection and try again.");
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

  // Enter sends; Shift+Enter starts a new line, as in the customer's reply box.
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`rounded-2xl p-4 shadow-sm ring-1 ring-gray-200 ${mode.box}`}
    >
      <div role="group" aria-label="Message type" className="mb-3 flex gap-2">
        {(Object.keys(MODES) as StaffMessageKind[]).map((option) => {
          const selected = option === kind;
          const disabled = pending || (option === "reply" && !acceptsReplies);
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => setKind(option)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                selected
                  ? MODES[option].selectedTab
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {MODES[option].tab}
            </button>
          );
        })}
      </div>
      {!acceptsReplies && (
        <p className="mb-3 text-xs text-gray-600">
          This ticket is closed, so it takes internal notes only.
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      <div className="flex items-end gap-3">
        <label htmlFor="staff-reply-input" className="sr-only">
          {mode.tab}
        </label>
        <textarea
          ref={inputRef}
          id="staff-reply-input"
          rows={2}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder={mode.placeholder}
          disabled={pending}
          className="max-h-60 flex-1 resize-none rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-black outline-none field-sizing-content placeholder:text-gray-400 focus:border-black disabled:bg-gray-100"
        />
        <button
          type="submit"
          disabled={pending || !content.trim()}
          className={`rounded-xl px-5 py-3 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${mode.button}`}
        >
          {pending ? "Posting..." : mode.submit}
        </button>
      </div>
    </form>
  );
}
