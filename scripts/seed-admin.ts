// Creates the admin account, or promotes and resets it if the email already
// exists. Run with `npm run db:seed`; credentials come from SEED_ADMIN_* in .env.
import { loadEnvConfig } from "@next/env";

// Runs outside Next.js, so load .env* before anything reads DATABASE_URL.
loadEnvConfig(process.cwd());

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

async function main() {
  const email = requireEnv("SEED_ADMIN_EMAIL").toLowerCase();
  const password = requireEnv("SEED_ADMIN_PASSWORD");
  const name = process.env.SEED_ADMIN_NAME?.trim() || "Admin";

  // Imported late so the env above is loaded first.
  const { auth } = await import("@/lib/auth");
  const ctx = await auth.$context;

  const { minPasswordLength, maxPasswordLength } = ctx.password.config;
  if (password.length < minPasswordLength || password.length > maxPasswordLength) {
    throw new Error(
      `SEED_ADMIN_PASSWORD must be ${minPasswordLength}-${maxPasswordLength} characters`,
    );
  }

  // Same hashing and account shape as Better Auth's email sign-up.
  const hash = await ctx.password.hash(password);
  const existing = await ctx.internalAdapter.findUserByEmail(email);

  if (!existing) {
    const user = await ctx.internalAdapter.createUser(
      { email, name, role: "admin", emailVerified: true },
      { method: "admin" },
    );
    await ctx.internalAdapter.linkAccount({
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: hash,
    });
    console.log(`Created admin ${email}`);
    return;
  }

  const { user } = existing;
  await ctx.internalAdapter.updateUser(user.id, { role: "admin" });
  if (await ctx.internalAdapter.findCredentialAccount(user.id)) {
    await ctx.internalAdapter.updatePassword(user.id, hash);
  } else {
    await ctx.internalAdapter.linkAccount({
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: hash,
    });
  }
  console.log(`Promoted ${email} to admin and reset its password`);
}

main().catch((error) => {
  // Drizzle wraps driver errors, so the useful reason is often in `cause`.
  console.error(error instanceof Error ? error.message : error);
  if (error instanceof Error && error.cause) console.error(error.cause);
  process.exit(1);
});
