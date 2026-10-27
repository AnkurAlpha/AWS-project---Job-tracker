const test = require("node:test");
const assert = require("node:assert/strict");
const poolPath = require.resolve("../db/pool");
const jwtPath = require.resolve("../utils/jwt");
let queries = [];
let rows = [];
require.cache[poolPath] = { id: poolPath, filename: poolPath, loaded: true, exports: {
  query: async (sql) => { queries.push(sql); return { rows }; },
} };
require.cache[jwtPath] = { id: jwtPath, filename: jwtPath, loaded: true, exports: {
  getJwtConfig: () => ({ secret: "isolated-test-secret" }),
  createAdminToken: (user) => `test-token-${user.username}`,
} };
const { login, signup } = require("../controllers/auth.controller");
const { hashPassword } = require("../utils/password");

function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; } };
}
function config() {
  process.env.ADMIN_USERNAME = "sohom-admin";
  process.env.ADMIN_PASSWORD = "test-only-assigned-password";
  delete process.env.ALLOW_ADMIN_SIGNUP;
  queries = [];
  rows = [];
}

test("public signup is blocked without performing database writes", async () => {
  config();
  const res = response();
  await signup({ body: { username: "intruder", password: "test-password" } }, res);
  assert.equal(res.statusCode, 403);
  assert.equal(queries.length, 0);
});
test("the assigned password works even when a database row has the same username", async () => {
  config();
  rows = [{ id: 12, username: "sohom-admin", password_hash: hashPassword("old-test-password") }];
  const res = response();
  await login({ body: { username: "sohom-admin", password: process.env.ADMIN_PASSWORD } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.user.username, "sohom-admin");
  assert.equal(res.body.user.id, 0);
  assert.ok(res.body.token);
  assert.ok(!queries.some((sql) => sql.includes("SELECT id")));
});
test("an older database password cannot bypass the assigned account password", async () => {
  config();
  rows = [{ id: 12, username: "sohom-admin", password_hash: hashPassword("old-test-password") }];
  const res = response();
  await login({ body: { username: "sohom-admin", password: "old-test-password" } }, res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.token, undefined);
});
test("other database accounts still verify their stored password hash", async () => {
  config();
  rows = [{ id: 21, username: "existing-user", password_hash: hashPassword("existing-test-password") }];
  const res = response();
  await login({ body: { username: "existing-user", password: "existing-test-password" } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.user.id, 21);
});
test("an incorrect assigned password receives no token", async () => {
  config();
  const res = response();
  await login({ body: { username: "sohom-admin", password: "incorrect-test-password" } }, res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.token, undefined);
});
