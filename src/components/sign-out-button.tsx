"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleSignOut() {
    setPending(true);
    setFailed(false);
    const { error } = await signOut();
    if (error) {
      setFailed(true);
      setPending(false);
      return;
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      {failed && (
        <span role="alert" className="text-sm text-red-600">
          Sign out failed.
        </span>
      )}
      <button
        type="button"
        onClick={handleSignOut}
        disabled={pending}
        className="rounded-xl border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Signing out..." : failed ? "Try again" : "Sign out"}
      </button>
    </div>
  );
}
