"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Support chat" },
  { href: "/tickets", label: "My tickets" },
] as const;

function isActive(pathname: string, href: string): boolean {
  // "My tickets" stays highlighted inside a ticket thread.
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

export function CustomerNav() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 text-sm">
      {LINKS.map(({ href, label }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`rounded-xl px-3 py-1.5 font-medium ${
              active ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
