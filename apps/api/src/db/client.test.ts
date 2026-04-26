import test from "node:test";
import assert from "node:assert/strict";
import type pg from "pg";
import { withTransaction, type TransactionClient } from "./client";

function createFakeTransactionClient() {
  const queries: string[] = [];
  let released = false;

  const client = {
    async query<Row extends pg.QueryResultRow = pg.QueryResultRow>(text: string) {
      queries.push(text);
      return { rows: [] } as unknown as pg.QueryResult<Row>;
    },
    release() {
      released = true;
    },
  } as TransactionClient;

  return {
    client,
    queries,
    get released() {
      return released;
    },
  };
}

test("withTransaction commits on success", async () => {
  const fake = createFakeTransactionClient();

  const result = await withTransaction(
    async (tx) => {
      await tx.query("select 1");
      return "ok";
    },
    {
      connect: async () => fake.client,
    }
  );

  assert.equal(result, "ok");
  assert.deepEqual(fake.queries, ["BEGIN", "select 1", "COMMIT"]);
  assert.equal(fake.released, true);
});

test("withTransaction rolls back on error", async () => {
  const fake = createFakeTransactionClient();

  await assert.rejects(
    () =>
      withTransaction(
        async (tx) => {
          await tx.query("select 1");
          throw new Error("boom");
        },
        {
          connect: async () => fake.client,
        }
      ),
    /boom/
  );

  assert.deepEqual(fake.queries, ["BEGIN", "select 1", "ROLLBACK"]);
  assert.equal(fake.released, true);
});
