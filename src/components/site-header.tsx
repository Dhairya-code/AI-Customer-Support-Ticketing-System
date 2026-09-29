import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { SignOutButton } from "./sign-out-button";

export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="border-b border-gray-200 bg-white">
      <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-bold text-gray-900">
          AI Support
        </Link>

        {user ? (
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black text-sm font-semibold text-white"
            >
              {(user.name || user.email).charAt(0).toUpperCase()}
            </span>
            <div className="hidden min-w-0 text-sm sm:block">
              <p className="truncate font-medium text-gray-900">{user.name}</p>
              <p className="truncate text-gray-500">{user.email}</p>
            </div>
            <SignOutButton />
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <Link
              href="/login"
              className="rounded-xl px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-100"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="rounded-xl bg-black px-3 py-1.5 font-medium text-white hover:bg-gray-800"
            >
              Create account
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}
