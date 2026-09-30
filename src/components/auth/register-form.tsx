"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { signUp } from "@/lib/auth-client";
import {
  authErrorMessage,
  settleAuthCall,
  type FieldErrors,
  MIN_PASSWORD_LENGTH,
  type RegisterInput,
  validateRegister,
} from "@/lib/auth-forms";
import { FormAlert, FormField, SubmitButton } from "./form-controls";

export function RegisterForm() {
  const router = useRouter();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<RegisterInput>>(
    {},
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const form = new FormData(event.currentTarget);
    const validation = validateRegister({
      name: String(form.get("name") ?? ""),
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

    // No role is sent: the server assigns `customer` and rejects client input.
    const { error } = await settleAuthCall(signUp.email(validation.data));
    if (error) {
      setFormError(authErrorMessage(error));
      setPending(false);
      return;
    }

    // Sign-up also signs the user in; refresh so server components see it.
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <FormAlert message={formError} />
      <FormField
        label="Name"
        name="name"
        autoComplete="name"
        placeholder="Ada Lovelace"
        disabled={pending}
        error={fieldErrors.name}
      />
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
        autoComplete="new-password"
        placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
        disabled={pending}
        error={fieldErrors.password}
      />
      <SubmitButton pending={pending} pendingLabel="Creating account...">
        Create account
      </SubmitButton>
      <p className="text-center text-sm text-gray-600">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-black underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
