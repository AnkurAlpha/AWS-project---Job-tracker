const test = require("node:test");
const assert = require("node:assert/strict");
const poolPath = require.resolve("../db/pool");
let databaseAvailable = true;
require.cache[poolPath] = { id: poolPath, filename: poolPath, loaded: true, exports: {
  query: async () => {
    if (!databaseAvailable) throw new Error("isolated database outage");
    return { rows: [{ result: 1 }] };
  },
} };
const app = require("../server");
test("readiness tracks database availability without exposing internal errors", async () => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const url = `http://127.0.0.1:${server.address().port}/health`;
  try {
    const ready = await fetch(url);
    assert.equal(ready.status, 200);
    assert.deepEqual(await ready.json(), { ok: true, database: "ready" });
    databaseAvailable = false;
    const unavailable = await fetch(url);
    assert.equal(unavailable.status, 503);
    assert.deepEqual(await unavailable.json(), { ok: false, database: "unavailable" });
    assert.equal(unavailable.headers.get("x-powered-by"), null);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  }
});
