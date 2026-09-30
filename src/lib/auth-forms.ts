// Client-side checks for the customer auth forms. Limits mirror Better Auth's
// email/password defaults so the server rarely rejects what passes here.
export const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Shared by client-side checks and server error codes so both read the same.
const INVALID_EMAIL = "Enter a valid email address.";
const PASSWORD_TOO_SHORT = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
const PASSWORD_TOO_LONG = `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`;

export type LoginInput = { email: string; password: string };
export type RegisterInput = LoginInput & { name: string };

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: FieldErrors<T> };

function checkEmail(email: string): string | undefined {
  return EMAIL_PATTERN.test(email) ? undefined : INVALID_EMAIL;
}

function checkNewPassword(password: string): string | undefined {
  if (password.length < MIN_PASSWORD_LENGTH) return PASSWORD_TOO_SHORT;
  if (password.length > MAX_PASSWORD_LENGTH) return PASSWORD_TOO_LONG;
  return undefined;
}

function toValidationResult<T>(data: T, errors: FieldErrors<T>): ValidationResult<T> {
  const failed = Object.values(errors).some(Boolean);
  if (!failed) return { ok: true, data };
  const present = Object.fromEntries(
    Object.entries(errors).filter(([, message]) => message),
  ) as FieldErrors<T>;
  return { ok: false, errors: present };
}

// The subset of a Better Auth client `error` that the messages depend on.
export type AuthClientError = { status: number; code?: string; message?: string };

// Not a Better Auth code: settleAuthCall uses it for requests that got no
// response at all.
const NETWORK_ERROR = "NETWORK_ERROR";

const ACCOUNT_EXISTS =
  "An account with this email already exists. Try signing in instead.";

const MESSAGES_BY_CODE: Record<string, string> = {
  USER_ALREADY_EXISTS: ACCOUNT_EXISTS,
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: ACCOUNT_EXISTS,
  INVALID_EMAIL_OR_PASSWORD: "Incorrect email or password.",
  INVALID_EMAIL,
  PASSWORD_TOO_SHORT,
  PASSWORD_TOO_LONG,
  [NETWORK_ERROR]:
    "Couldn't reach the server. Check your connection and try again.",
};

// The Better Auth client reports API errors in its result but rejects when the
// request never reaches the server; this folds that case into the same result
// shape, so a form can't be left stuck in its pending state.
export async function settleAuthCall<R>(
  call: Promise<R>,
): Promise<R | { data: null; error: AuthClientError }> {
  try {
    return await call;
  } catch (error) {
    console.error("Auth request failed before reaching the server", error);
    return { data: null, error: { status: 0, code: NETWORK_ERROR } };
  }
}

// Server messages are never shown verbatim; unknown errors get a generic line.
export function authErrorMessage(error: AuthClientError): string {
  if (error.code && MESSAGES_BY_CODE[error.code]) {
    return MESSAGES_BY_CODE[error.code];
  }
  if (error.status === 429) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  return "Something went wrong. Please try again.";
}

// Sign-in skips the length rules: they are for choosing a new password only.
export function validateLogin(input: LoginInput) {
  const data = { email: input.email.trim(), password: input.password };
  return toValidationResult(data, {
    email: checkEmail(data.email),
    password: data.password ? undefined : "Enter your password.",
  });
}

export function validateRegister(input: RegisterInput) {
  const data = {
    name: input.name.trim(),
    email: input.email.trim(),
    password: input.password,
  };
  return toValidationResult(data, {
    name: data.name ? undefined : "Enter your name.",
    email: checkEmail(data.email),
    password: checkNewPassword(data.password),
  });
}
