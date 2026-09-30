import { describe, expect, it, vi } from "vitest";
import {
  authErrorMessage,
  settleAuthCall,
  validateLogin,
  validateRegister,
} from "./auth-forms";

describe("validateRegister", () => {
  it("accepts a complete registration and trims name and email", () => {
    expect(
      validateRegister({
        name: "  Ada Lovelace ",
        email: " ada@example.com ",
        password: "correct-horse",
      }),
    ).toEqual({
      ok: true,
      data: {
        name: "Ada Lovelace",
        email: "ada@example.com",
        password: "correct-horse",
      },
    });
  });

  it("reports every invalid field at once", () => {
    expect(
      validateRegister({ name: " ", email: "not-an-email", password: "short" }),
    ).toEqual({
      ok: false,
      errors: {
        name: "Enter your name.",
        email: "Enter a valid email address.",
        password: "Password must be at least 8 characters.",
      },
    });
  });
});

describe("authErrorMessage", () => {
  it("tells the user an email is already registered", () => {
    expect(
      authErrorMessage({ status: 422, code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" }),
    ).toBe("An account with this email already exists. Try signing in instead.");
    expect(authErrorMessage({ status: 422, code: "USER_ALREADY_EXISTS" })).toBe(
      "An account with this email already exists. Try signing in instead.",
    );
  });

  it("does not reveal which credential was wrong", () => {
    expect(
      authErrorMessage({ status: 401, code: "INVALID_EMAIL_OR_PASSWORD" }),
    ).toBe("Incorrect email or password.");
  });

  it("asks the user to slow down when rate limited", () => {
    expect(authErrorMessage({ status: 429 })).toBe(
      "Too many attempts. Please wait a moment and try again.",
    );
  });

  it("falls back to a generic message for unknown errors", () => {
    expect(
      authErrorMessage({ status: 500, code: "SOMETHING_ODD", message: "boom" }),
    ).toBe("Something went wrong. Please try again.");
  });
});

describe("settleAuthCall", () => {
  it("passes the client's own result through", async () => {
    const result = { data: { ok: true }, error: null };
    await expect(settleAuthCall(Promise.resolve(result))).resolves.toBe(result);
  });

  it("turns a request that never reached the server into an error result", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { data, error } = await settleAuthCall(
      Promise.reject(new TypeError("Failed to fetch")),
    );
    expect(data).toBeNull();
    expect(error && authErrorMessage(error)).toBe(
      "Couldn't reach the server. Check your connection and try again.",
    );
  });
});

describe("validateLogin", () => {
  it("accepts any non-empty password so existing accounts can sign in", () => {
    expect(validateLogin({ email: "ada@example.com ", password: "x" })).toEqual(
      { ok: true, data: { email: "ada@example.com", password: "x" } },
    );
  });

  it("requires an email and a password", () => {
    expect(validateLogin({ email: "", password: "" })).toEqual({
      ok: false,
      errors: {
        email: "Enter a valid email address.",
        password: "Enter your password.",
      },
    });
  });
});
