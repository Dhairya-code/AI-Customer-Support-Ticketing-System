"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { signIn, signOut } from "@/lib/auth-client";
import {
  authErrorMessage,
  settleAuthCall,
  type FieldErrors,
  type LoginInput,
  validateLogin,
} from "@/lib/auth-forms";
import { verifyStaffSignIn } from "@/lib/staff-auth";
import { FormAlert, FormField, SubmitButton } from "./form-controls";

export function StaffLoginForm() {
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

    const { data, error } = await settleAuthCall(
      signIn.email(validation.data),
    );
    if (error) {
      setFormError(authErrorMessage(error));
      setPending(false);
      return;
    }

    // The role is only known once credentials are accepted, so customers get
    // a session here that has to be ended straight away.
    const refusal = await verifyStaffSignIn(data.user, signOut);
    if (refusal) {
      setFormError(refusal);
      setPending(false);
      return;
    }

    router.replace("/admin");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <FormAlert message={formError} />
      <FormField
        label="Work email"
        name="email"
        type="email"
        autoComplete="username"
        placeholder="you@company.com"
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
      <SubmitButton pending={pending} pendingLabel="Verifying...">
        Sign in to staff portal
      </SubmitButton>
    </form>
  );
}
