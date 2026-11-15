import { loadEnv } from "./lib/load-env";

const HELP = `Usage: pnpm seed:demo [--reset]

Fills an EMPTY database with fictional demo data (organization, library, templates, users in
several onboarding states, events, notifications). Everything is created through the services.
Prints the demo credentials at the end.

  --reset   Wipes all application data first. Refused when NODE_ENV=production.
            Without --reset the script refuses to run as soon as any user exists.

Optional: SEED_DEMO_PASSWORD sets the password of all demo accounts (min. 12 characters),
otherwise a random one is generated.`;

async function main(): Promise<void> {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(HELP);
    return;
  }

  loadEnv();
  // The demo accounts get their invitation mails rendered but never sent, and the per-mutation
  // info logs would drown the summary. Set before the services read the configuration.
  process.env.MAIL_TRANSPORT = "memory";
  process.env.LOG_LEVEL = "warn";

  const { runDemoSeed } = await import("./demo-data/run");
  const { SeedRefusedError } = await import("./demo-data/guard");
  const { closeDb } = await import("@/server/db/client");

  try {
    const result = await runDemoSeed({
      reset: process.argv.includes("--reset"),
      password: process.env.SEED_DEMO_PASSWORD || undefined,
      log: (line) => console.log(line),
    });
    console.log("\nDemo data created. Sign in with (same password for all accounts):\n");
    for (const entry of result.credentials) {
      console.log(
        `  ${entry.role.padEnd(10)} ${entry.email.padEnd(40)} ${entry.name} (${entry.state})`,
      );
    }
    console.log(`\n  Password: ${result.password}\n`);
  } catch (error) {
    if (error instanceof SeedRefusedError) {
      console.error(error.message);
    } else {
      console.error("seed:demo failed:", error instanceof Error ? error.message : "unknown error");
    }
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
}

await main();
