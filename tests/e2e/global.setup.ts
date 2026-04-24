import { execSync } from "node:child_process";
import path from "node:path";

export default async function globalSetup() {
  const repoRoot = path.resolve(__dirname, "../..");
  execSync("pnpm --dir apps/api test:seed:e2e", {
    cwd: repoRoot,
    stdio: "inherit",
  });
}
