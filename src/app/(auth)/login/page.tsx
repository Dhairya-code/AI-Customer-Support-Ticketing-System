import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { redirectIfSignedIn } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  await redirectIfSignedIn();

  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
      <p className="mt-1 mb-6 text-sm text-gray-500">
        Sign in to chat with support and track your tickets.
      </p>
      <LoginForm />
    </>
  );
}
