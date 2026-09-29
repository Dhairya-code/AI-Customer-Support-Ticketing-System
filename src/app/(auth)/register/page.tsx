import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";
import { redirectIfSignedIn } from "@/lib/session";

export const metadata: Metadata = {
  title: "Create account | AI Customer Support",
};

export default async function RegisterPage() {
  await redirectIfSignedIn();

  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
      <p className="mt-1 mb-6 text-sm text-gray-500">
        Get instant help from our AI assistant and support team.
      </p>
      <RegisterForm />
    </>
  );
}
