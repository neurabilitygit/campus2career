import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | null = null;

function getConnectionHost(connectionString: string): string | null {
  try {
    return new URL(connectionString).hostname || null;
  } catch {
    return null;
  }
}

function resolveSslConfig(connectionString: string): pg.PoolConfig["ssl"] {
  const host = getConnectionHost(connectionString)?.toLowerCase() || "";
  const isLocalHost =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local");

  if (isLocalHost) {
    return undefined;
  }

  return { rejectUnauthorized: true };
}

export function getDbPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is required");
    }

    pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      ssl: resolveSslConfig(connectionString),
    });
  }

  return pool;
}

export async function closeDbPool(): Promise<void> {
  if (!pool) {
    return;
  }

  const activePool = pool;
  pool = null;
  await activePool.end();
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<pg.QueryResult<T>> {
  const db = getDbPool();
  return db.query<T>(text, params);
}
