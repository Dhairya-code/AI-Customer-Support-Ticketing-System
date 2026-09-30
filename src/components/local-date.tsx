"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// False while rendering on the server and hydrating, true afterwards: React
// hydrates with the server snapshot, then re-renders with the client one.
function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

// Formats in the viewer's own timezone, so a ticket opened late in the evening
// doesn't show the next day's date. The server renders a UTC date, and the
// browser re-renders it in local time once hydrated (suppressHydrationWarning
// alone would keep the server's UTC text; it stays to cover small differences
// between the server's and the browser's formatting of that UTC text).
export function LocalDate({
  date,
  prefix = "",
  withTime = false,
}: {
  date: Date;
  prefix?: string;
  withTime?: boolean;
}) {
  const hydrated = useHydrated();
  const formatted = date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: withTime ? "short" : undefined,
    timeZone: hydrated ? undefined : "UTC",
  });
  return (
    <time dateTime={date.toISOString()} suppressHydrationWarning>
      {prefix}
      {formatted}
    </time>
  );
}
