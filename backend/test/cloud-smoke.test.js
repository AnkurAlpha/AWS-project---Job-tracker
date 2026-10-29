const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { PGlite } = require("@electric-sql/pglite");
const { makeEvent, withDomainEvent } = require("../services/domain-events.cjs");
const { dispatchBatch, pruneDeliveredEvents } = require("../services/outbox-dispatcher.cjs");
const { migrate } = require("../db/migrate.cjs");
const { loginLimiter } = require("../middleware/security.cjs");
const { databaseConfig } = require("../db/config.cjs");

// Real embedded PostgreSQL engine, loopback HTTP only, fake queue. No AWS calls.
const database = new PGlite();
async function query(sql, parameters) {
  // Match node-postgres: parameterless queries use the simple-query protocol,
  // which accepts migration batches. PGlite.query always uses prepared queries.
  if (parameters !== undefined) return database.query(sql, parameters);
  return (await database.exec(sql)).at(-1) || { rows: [] };
}
const pool = {
  query,
  connect: async () => ({ query, release() {} }),
};
const poolPath = require.resolve("../db/pool");
require.cache[poolPath] = { id: poolPath, filename: poolPath, loaded: true, exports: pool };
process.env.AWS_EVENTS_ENABLED = "true";
process.env.JWT_SECRET = "isolated-postgres-smoke-secret";
process.env.ADMIN_USERNAME = "sohom-admin";
process.env.ADMIN_PASSWORD = "isolated-smoke-password-only";
process.env.ALLOW_ADMIN_SIGNUP = "false";
const app = require("../server");
let server;
let origin;

test.before(async () => {
  await database.exec(await fs.readFile(path.join(__dirname, "../db/init.sql"), "utf8"));
  await migrate(pool);
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
test.beforeEach(async () => {
  await database.exec("DELETE FROM applications; DELETE FROM jobs; DELETE FROM cloud_outbox;");
});
test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await database.close();
});

async function request(route, method = "GET", body, token) {
  return fetch(origin + route, { method, headers: {
    ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}

test("smoke: assigned admin, candidate workflow, authorization, and five private outbox events", async () => {
  const login = await request("/auth/login", "POST", { username: "sohom-admin", password: process.env.ADMIN_PASSWORD });
  assert.equal(login.status, 200);
  const { token } = await login.json();
  assert.equal((await request("/operations/events")).status, 401);
  assert.equal((await request("/jobs", "POST", { title: "Unauthorized", description: "No" })).status, 401);
  assert.equal((await request("/auth/signup", "POST", { username: "public", password: "test-only-password" })).status, 403);

  const created = await request("/jobs", "POST", { title: "Smoke role", description: "Synthetic test data" }, token);
  assert.equal(created.status, 201);
  const job = await created.json();
  const submitted = await request("/applications", "POST", {
    jobId: job.id, name: "Synthetic Candidate", email: "candidate@example.invalid", resume: "Synthetic resume only",
  });
  assert.equal(submitted.status, 201);
  const { application } = await submitted.json();
  assert.equal((await request(`/applications/${application.id}/status`, "PATCH", { status: "interview" }, token)).status, 200);
  assert.equal((await request("/applications", "GET", undefined, token)).status, 200);
  assert.equal((await request(`/applications/${application.id}`, "DELETE", undefined, token)).status, 200);
  assert.equal((await request(`/jobs/${job.id}`, "DELETE", undefined, token)).status, 200);
  const events = await pool.query("SELECT payload FROM cloud_outbox ORDER BY created_at");
  assert.equal(events.rows.length, 5);
  const encoded = JSON.stringify(events.rows);
  for (const privateValue of ["candidate@example.invalid", "Synthetic Candidate", "Synthetic resume", process.env.ADMIN_PASSWORD, token]) {
    assert.ok(!encoded.includes(privateValue));
  }
  const status = await request("/operations/events", "GET", undefined, token);
  assert.deepEqual(await status.json(), { enabled: true, pending: 5, delivered: 0, deadLettered: 0 });
  assert.equal(status.headers.get("cache-control"), "no-store");
  assert.ok(status.headers.get("x-request-id"));
});

test("business mutation rolls back when an outbox insert fails", async () => {
  await assert.rejects(withDomainEvent(pool, (db) => db.query(
    "INSERT INTO jobs (title, description) VALUES ('must rollback', 'test') RETURNING id"),
  (result) => ({ event_id: "not-a-uuid", event_type: "job.published", job_id: result.rows[0].id })));
  assert.equal((await pool.query("SELECT * FROM jobs")).rows.length, 0);
  assert.equal((await pool.query("SELECT * FROM cloud_outbox")).rows.length, 0);
});

test("queue outage retries a committed event; later delivery drains it without losing the mutation", async () => {
  await withDomainEvent(pool, (db) => db.query(
    "INSERT INTO jobs (title, description) VALUES ('survives outage', 'test') RETURNING id"),
  (r) => makeEvent("job.published", { job_id: r.rows[0].id }));
  const failed = await dispatchBatch(pool, async () => { throw new Error("fake queue outage"); });
  assert.equal(failed.retried, 1);
  assert.equal((await pool.query("SELECT * FROM jobs")).rows.length, 1);
  const row = (await pool.query("SELECT * FROM cloud_outbox")).rows[0];
  assert.equal(row.dispatched_at, null);
  assert.equal(row.last_error_code, "Error");
  await pool.query("UPDATE cloud_outbox SET available_at = NOW() - INTERVAL '1 second'");
  let sent;
  const success = await dispatchBatch(pool, async (event) => { sent = event; });
  assert.equal(success.sent, 1);
  assert.equal(sent.event_id, row.event_id);
  assert.equal((await dispatchBatch(pool, async () => assert.fail("Already dispatched"))).claimed, 0);
});

test("a poison outbox event is dead-lettered after its bounded attempts", async () => {
  const event = makeEvent("job.published", { job_id: 1 });
  await pool.query("INSERT INTO cloud_outbox (event_id, event_type, payload, attempts) VALUES ($1, $2, $3, 11)",
    [event.event_id, event.event_type, JSON.stringify(event)]);
  const result = await dispatchBatch(pool, async () => { throw new Error("test failure"); });
  assert.equal(result.deadLettered, 1);
  assert.equal((await dispatchBatch(pool, async () => assert.fail("Dead-lettered"))).claimed, 0);
});

test("off mode performs the business write without an AWS event or client transaction", async () => {
  const result = await withDomainEvent(pool, (db) => db.query(
    "INSERT INTO jobs (title, description) VALUES ('off mode', 'test') RETURNING id"),
  () => assert.fail("Feature disabled"), false);
  assert.ok(result.rows[0].id);
  assert.equal((await pool.query("SELECT * FROM cloud_outbox")).rows.length, 0);
});

test("migrations are repeatable and outbox retention never deletes jobs", async () => {
  await migrate(pool);
  await migrate(pool);
  assert.equal((await pool.query("SELECT * FROM schema_migrations")).rows.length, 1);
  const event = makeEvent("job.published", { job_id: 1 });
  await pool.query("INSERT INTO jobs (title, description) VALUES ('retain data', 'test')");
  await pool.query(`INSERT INTO cloud_outbox (event_id, event_type, payload, dispatched_at)
    VALUES ($1, $2, $3, NOW() - INTERVAL '8 days')`, [event.event_id, event.event_type, JSON.stringify(event)]);
  await pruneDeliveredEvents(pool);
  assert.equal((await pool.query("SELECT * FROM cloud_outbox")).rows.length, 0);
  assert.equal((await pool.query("SELECT * FROM jobs")).rows.length, 1);
});

test("private/unversioned events are refused before cloud delivery", () => {
  assert.throws(() => makeEvent("job.published", { job_id: 1, email: "private@example.invalid" }));
  assert.throws(() => makeEvent("application.submitted", { job_id: 1 }));
});

test("malformed inputs receive 400 rather than an unhandled string conversion error", async () => {
  assert.equal((await request("/applications", "POST", { jobId: 1, name: {}, email: [], resume: 1 })).status, 400);
});

test("login rate limit expires without timers or permanent lockout", () => {
  let time = 0;
  const limiter = loginLimiter({ limit: 2, windowMs: 1000, now: () => time });
  let passed = 0;
  const response = { statusCode: 200, setHeader() {}, status(value) { this.statusCode = value; return this; }, json() {} };
  for (let i = 0; i < 3; i++) limiter({ ip: "127.0.0.1" }, response, () => passed++);
  assert.equal(passed, 2);
  assert.equal(response.statusCode, 429);
  time = 1001;
  limiter({ ip: "127.0.0.1" }, response, () => passed++);
  assert.equal(passed, 3);
});

test("managed database TLS requires a CA and cannot be overridden by URL sslmode", () => {
  const env = { DATABASE_URL: "postgres://example.invalid/jobtracker", DATABASE_SSL: "true", DATABASE_SSL_CA_FILE: "/fake/ca.pem" };
  const config = databaseConfig(env, () => "test CA contents");
  assert.equal(config.ssl.rejectUnauthorized, true);
  assert.equal(config.ssl.ca, "test CA contents");
  assert.throws(() => databaseConfig({ ...env, DATABASE_URL: env.DATABASE_URL + "?sslmode=no-verify" }));
  assert.throws(() => databaseConfig({ ...env, DATABASE_SSL_CA_FILE: "" }));
});
