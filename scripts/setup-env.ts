import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const target = path.join(root, ".env");
const example = path.join(root, ".env.example");

if (existsSync(target)) {
  console.log(".env exists, not touched");
} else {
  const secret = randomBytes(32).toString("base64url");
  const content = readFileSync(example, "utf8").replace(/^BETTER_AUTH_SECRET=.*$/m, () => {
    return `BETTER_AUTH_SECRET=${secret}`;
  });
  writeFileSync(target, content, { mode: 0o600 });
  console.log("created .env");
}
