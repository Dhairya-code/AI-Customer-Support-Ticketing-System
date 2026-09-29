"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { signIn } from "@/lib/auth-client";
import {
  authErrorMessage,
  type FieldErrors,
  type LoginInput,
  validateLogin,
} from "@/lib/auth-forms";
import { FormAlert, FormField, SubmitButton } from "./form-controls";

export function LoginForm() {
  const router = useRouter();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<LoginInput>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const form = new FormData(event.currentTarget);
    const validation = validateLogin({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    });

    setFormError(null);
    if (!validation.ok) {
      setFieldErrors(validation.errors);
      return;
    }
    setFieldErrors({});
    setPending(true);

    const { error } = await signIn.email(validation.data);
    if (error) {
      setFormError(authErrorMessage(error));
      setPending(false);
      return;
    }

    // Refresh so server components (header, guards) see the new session.
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <FormAlert message={formError} />
      <FormField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        disabled={pending}
        error={fieldErrors.email}
      />
      <FormField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        disabled={pending}
        error={fieldErrors.password}
      />
      <SubmitButton pending={pending} pendingLabel="Signing in...">
        Sign in
      </SubmitButton>
      <p className="text-center text-sm text-gray-600">
        New here?{" "}
        <Link href="/register" className="font-medium text-black underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
