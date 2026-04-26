import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | null = null;

export interface DbExecutor {
  query: pg.Pool["query"];
}

export type TransactionClient = pg.PoolClient;

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

    pool.on("error", (error) => {
      console.error("Postgres pool error", error);
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
  return executeQuery<T>(undefined, text, params);
}

export async function executeQuery<T extends pg.QueryResultRow = pg.QueryResultRow>(
  executor: DbExecutor | undefined,
  text: string,
  params: unknown[] = []
): Promise<pg.QueryResult<T>> {
  const db = executor ?? getDbPool();
  return db.query<T>(text, params);
}

export async function withTransaction<T>(
  fn: (tx: TransactionClient) => Promise<T>,
  options?: { connect?: () => Promise<TransactionClient> }
): Promise<T> {
  const connect = options?.connect ?? (async () => getDbPool().connect() as Promise<TransactionClient>);
  const client = await connect();

  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Postgres transaction rollback failed", rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}
