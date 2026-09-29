import { describe, expect, it, vi } from "vitest";
import { STAFF_ONLY_MESSAGE, verifyStaffSignIn } from "./staff-auth";

describe("verifyStaffSignIn", () => {
  it("rejects a customer and ends the session they just opened", async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);

    const error = await verifyStaffSignIn({ role: "customer" }, signOut);

    expect(error).toBe(STAFF_ONLY_MESSAGE);
    expect(signOut).toHaveBeenCalledOnce();
  });

  it.each([null, undefined, "superuser"])(
    "rejects a user whose role is %s",
    async (role) => {
      const signOut = vi.fn().mockResolvedValue(undefined);

      expect(await verifyStaffSignIn({ role }, signOut)).toBe(STAFF_ONLY_MESSAGE);
      expect(signOut).toHaveBeenCalledOnce();
    },
  );

  it("still refuses entry when ending the session fails", async () => {
    const signOut = vi.fn().mockRejectedValue(new Error("network down"));

    expect(await verifyStaffSignIn({ role: "customer" }, signOut)).toBe(
      STAFF_ONLY_MESSAGE,
    );
  });

  it.each(["agent", "admin"])("lets an %s in and keeps their session", async (role) => {
    const signOut = vi.fn();

    expect(await verifyStaffSignIn({ role }, signOut)).toBeNull();
    expect(signOut).not.toHaveBeenCalled();
  });
});
