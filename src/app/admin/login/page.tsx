import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StaffLoginForm } from "@/components/auth/staff-login-form";
import { getCurrentUser } from "@/lib/session";
import { isStaff } from "@/lib/staff-auth";

// Unlisted: nothing links here and search engines are asked to skip it.
export const metadata: Metadata = {
  title: "Staff sign in",
  robots: { index: false, follow: false },
};

export default async function StaffLoginPage() {
  // A signed-in customer still sees the form so a staff member sharing the
  // browser can switch accounts.
  const user = await getCurrentUser();
  if (user && isStaff(user)) {
    redirect("/admin");
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-gray-950 p-4">
      <div className="w-full max-w-md">
        <p className="mb-4 text-center text-xs font-semibold tracking-widest text-gray-400 uppercase">
          ResolveAI · Staff portal
        </p>
        <div className="rounded-2xl bg-white p-8 shadow-2xl ring-1 ring-white/10">
          <h1 className="text-2xl font-bold text-gray-900">Staff sign in</h1>
          <p className="mt-1 mb-6 text-sm text-gray-500">
            Restricted to support agents and administrators.
          </p>
          <StaffLoginForm />
        </div>
      </div>
    </main>
  );
}
