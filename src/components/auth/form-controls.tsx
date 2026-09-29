import type { ComponentProps } from "react";

type FormFieldProps = Omit<ComponentProps<"input">, "id" | "className"> & {
  label: string;
  name: string;
  error?: string;
};

export function FormField({ label, name, error, ...inputProps }: FormFieldProps) {
  const errorId = `${name}-error`;

  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        {...inputProps}
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`w-full rounded-xl border bg-white px-4 py-3 text-sm text-black outline-none placeholder:text-gray-400 focus:border-black disabled:bg-gray-100 ${
          error ? "border-red-500" : "border-gray-300"
        }`}
      />
      {error && (
        <p id={errorId} className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

export function FormAlert({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      {message}
    </div>
  );
}

export function SubmitButton({
  pending,
  children,
  pendingLabel,
}: {
  pending: boolean;
  children: string;
  pendingLabel: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
