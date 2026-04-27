import { closeDbPool } from "../db/client";
import { refreshMarketReferenceData } from "../services/market/refresh";

function parseRoleArgs(argv: string[]): string[] {
  const roles: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--role") {
      const value = argv[index + 1];
      if (value) {
        roles.push(value);
        index += 1;
      }
    } else if (token.startsWith("--role=")) {
      roles.push(token.slice("--role=".length));
    }
  }

  return roles;
}

async function main() {
  const roleCanonicalNames = parseRoleArgs(process.argv.slice(2));
  try {
    const summary = await refreshMarketReferenceData({ roleCanonicalNames });
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await closeDbPool();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
