export class SeedRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeedRefusedError";
  }
}

/**
 * The demo seed only ever fills an empty database. `--reset` wipes all application data first and
 * is therefore refused on a production database.
 * @throws SeedRefusedError
 */
export function assertSeedAllowed(input: {
  userCount: number;
  reset: boolean;
  nodeEnv: string | undefined;
}): void {
  if (input.reset && input.nodeEnv === "production") {
    throw new SeedRefusedError("--reset is refused when NODE_ENV=production");
  }
  if (input.userCount > 0 && !input.reset) {
    throw new SeedRefusedError(
      `The database already contains ${input.userCount} user(s). Refusing to seed. ` +
        "Use --reset (non-production only) to wipe all data first.",
    );
  }
}
