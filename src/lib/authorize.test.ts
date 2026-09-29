import { describe, expect, it } from "vitest";
import { AuthError, authorize } from "./authorize";

const customer = { id: "u1", role: "customer" as const };
const agent = { id: "u2", role: "agent" as const };
const admin = { id: "u3", role: "admin" as const };

describe("authorize", () => {
  it("rejects a missing user with 401", () => {
    expect(() => authorize(null, ["agent", "admin"])).toThrow(
      expect.objectContaining({ status: 401 }),
    );
  });

  it("rejects a user whose role is not allowed with 403", () => {
    expect(() => authorize(customer, ["agent", "admin"])).toThrow(
      expect.objectContaining({ status: 403 }),
    );
  });

  it("returns the user when their role is allowed", () => {
    expect(authorize(agent, ["agent", "admin"])).toBe(agent);
    expect(authorize(admin, ["agent", "admin"])).toBe(admin);
  });

  it("throws AuthError instances", () => {
    expect(() => authorize(null, ["customer"])).toThrow(AuthError);
  });

  it("rejects an unknown role stored on the user with 403", () => {
    const tampered = { id: "u4", role: "superuser" };
    expect(() => authorize(tampered, ["agent", "admin"])).toThrow(
      expect.objectContaining({ status: 403 }),
    );
  });

  it("rejects a user with no role with 403", () => {
    const roleless = { id: "u5", role: null };
    expect(() => authorize(roleless, ["customer"])).toThrow(
      expect.objectContaining({ status: 403 }),
    );
  });
});
