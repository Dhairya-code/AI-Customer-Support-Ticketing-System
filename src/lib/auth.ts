import "server-only";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";

// BETTER_AUTH_SECRET and BETTER_AUTH_URL are read from the environment.
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      // input: false stops clients from choosing their own role at sign-up;
      // staff roles are granted directly in the database.
      role: {
        type: [...schema.USER_ROLES],
        required: true,
        defaultValue: "customer",
        input: false,
      },
    },
  },
  plugins: [nextCookies()], // must stay last
});

export type Session = typeof auth.$Infer.Session;
export type SessionUser = Session["user"];
