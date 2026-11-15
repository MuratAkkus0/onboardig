import { input, password } from "@inquirer/prompts";
import { loadEnv } from "./lib/load-env";

const HELP = `Usage: pnpm seed:admin

Creates the first admin account.
Interactive: asks for email, first name, last name and a password (typed twice, hidden).
Non-interactive (CI/E2E): set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD
(optional SEED_ADMIN_FIRST_NAME, SEED_ADMIN_LAST_NAME).
The password is never printed.`;

async function main(): Promise<void> {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(HELP);
    return;
  }

  loadEnv();
  // Imported after the env is loaded: the services read configuration lazily on first use.
  const { createInitialAdmin } = await import("@/server/services/bootstrap");
  const { closeDb } = await import("@/server/db/client");
  const { isAppError } = await import("@/server/errors");
  const { APP_CONFIG } = await import("@/config/app");

  try {
    let email = process.env.SEED_ADMIN_EMAIL;
    let pass = process.env.SEED_ADMIN_PASSWORD;
    let firstName = process.env.SEED_ADMIN_FIRST_NAME ?? "Admin";
    let lastName = process.env.SEED_ADMIN_LAST_NAME ?? "User";

    if (!email || !pass) {
      email = await input({ message: "Email" });
      firstName = await input({ message: "First name", default: firstName });
      lastName = await input({ message: "Last name", default: lastName });
      pass = await password({ message: "Password", mask: "*" });
      const again = await password({ message: "Repeat password", mask: "*" });
      if (pass !== again) {
        console.error("Passwords do not match");
        process.exitCode = 1;
        return;
      }
    }

    if (
      pass.length < APP_CONFIG.auth.passwordMinLength ||
      pass.length > APP_CONFIG.auth.passwordMaxLength
    ) {
      console.error(
        `Password must be ${APP_CONFIG.auth.passwordMinLength}-${APP_CONFIG.auth.passwordMaxLength} characters`,
      );
      process.exitCode = 1;
      return;
    }

    await createInitialAdmin({
      email,
      password: pass,
      firstName,
      lastName,
      locale: APP_CONFIG.i18n.defaultLocale,
    });
    console.log("admin created");
  } catch (error) {
    if (isAppError(error) && error.code === "EMAIL_TAKEN") {
      console.error("A user with this email already exists");
    } else {
      console.error("seed:admin failed:", error instanceof Error ? error.message : "unknown error");
    }
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
}

await main();
