import type { Metadata } from "next";
import { SignOutButton } from "@/components/sign-out-button";
import { requireStaffPage } from "@/lib/session";

export const metadata: Metadata = {
  title: "Staff dashboard | AI Customer Support",
  robots: { index: false, follow: false },
};

// Landing spot for staff sign-in; the ticket queue and metrics arrive with
// ticket 12.
export default async function AdminPage() {
  const user = await requireStaffPage();

  return (
    <main className="flex-1 bg-gray-100 px-6 py-10">
      <div className="mx-auto flex max-w-5xl items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Support Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Signed in as {user.name} ({user.role}).
          </p>
        </div>
        <SignOutButton redirectTo="/admin/login" />
      </div>
    </main>
  );
}
