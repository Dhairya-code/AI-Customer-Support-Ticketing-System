"use client";

// Formats in the viewer's own timezone, so a ticket opened late in the evening
// doesn't show the next day's date. The server renders a UTC date that the
// browser swaps for the local one on hydration.
export function LocalDate({ date, prefix = "" }: { date: Date; prefix?: string }) {
  const formatted = date.toLocaleDateString("en-US", {
    dateStyle: "medium",
    timeZone: typeof window === "undefined" ? "UTC" : undefined,
  });
  return (
    <time dateTime={date.toISOString()} suppressHydrationWarning>
      {prefix}
      {formatted}
    </time>
  );
}
