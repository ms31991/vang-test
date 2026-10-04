import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendEnv = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../vanguarg/.env",
);

if (!process.env.CLERK_PUBLISHABLE_KEY && fs.existsSync(frontendEnv)) {
  const line = fs
    .readFileSync(frontendEnv, "utf8")
    .split(/\r?\n/)
    .find((row) => row.startsWith("VITE_CLERK_PUBLISHABLE_KEY="));
  if (line) {
    process.env.CLERK_PUBLISHABLE_KEY = line
      .slice("VITE_CLERK_PUBLISHABLE_KEY=".length)
      .trim();
  }
}
