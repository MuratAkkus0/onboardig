/** Shared by the Playwright config, the database preparation script and the specs. */
export const E2E_PORT = process.env.E2E_PORT ?? "3401";
export const E2E_DB_NAME = "onboarding_e2e_w4";
const SERVER = process.env.E2E_DB_SERVER ?? "postgres://onboarding:onboarding@localhost:5433";
export const E2E_ADMIN_DATABASE_URL = `${SERVER}/postgres`;
export const E2E_DATABASE_URL = `${SERVER}/${E2E_DB_NAME}`;
/** Throw-away values for a disposable database; not a secret. */
export const E2E_PASSWORD = "E2e-Passw0rd-demo-2026";
export const E2E_AUTH_SECRET = "e2e-secret-e2e-secret-e2e-secret-0123456789";

export const ADMIN = { email: "birgit@demo.test", password: E2E_PASSWORD };
/** Paul Becker: German, employee with a started plan and open steps. */
export const EMPLOYEE = { email: "paul@demo.test", password: E2E_PASSWORD };
