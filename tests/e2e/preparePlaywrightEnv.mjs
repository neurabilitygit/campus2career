import { execSync } from "node:child_process";

function killPort(port) {
  try {
    const output = execSync(`lsof -ti tcp:${port}`, {
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    }).trim();

    if (!output) {
      return;
    }

    const pids = output
      .split(/\s+/)
      .map((value) => value.trim())
      .filter(Boolean);

    if (!pids.length) {
      return;
    }

    execSync(`kill -9 ${pids.join(" ")}`, {
      stdio: "ignore",
    });
  } catch {
    // No listener was present, or it had already exited.
  }
}

for (const rawPort of process.argv.slice(2)) {
  const port = Number(rawPort);
  if (Number.isFinite(port) && port > 0) {
    killPort(port);
  }
}
