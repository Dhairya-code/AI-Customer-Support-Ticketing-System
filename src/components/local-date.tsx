"use client";

// Formats in the viewer's own timezone, so a ticket opened late in the evening
// doesn't show the next day's date. The server renders a UTC date that the
// browser swaps for the local one on hydration.
export function LocalDate({
  date,
  prefix = "",
  withTime = false,
}: {
  date: Date;
  prefix?: string;
  withTime?: boolean;
}) {
  const formatted = date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: withTime ? "short" : undefined,
    timeZone: typeof window === "undefined" ? "UTC" : undefined,
  });
  return (
    <time dateTime={date.toISOString()} suppressHydrationWarning>
      {prefix}
      {formatted}
    </time>
  );
}
