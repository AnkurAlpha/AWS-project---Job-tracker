const pool = require("../db/pool");
const { hashPassword, verifyPassword } = require("../utils/password");
const { createAdminToken, getJwtConfig } = require("../utils/jwt");

let authTableReady = false;

async function ensureAuthTable() {
  if (authTableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  authTableReady = true;
}

function validateCredentialInput(username, password) {
  const normalizedUsername = String(username || "").trim();
  const normalizedPassword = String(password || "");

  if (!normalizedUsername || !normalizedPassword) {
    return { error: "username and password are required" };
  }
  if (normalizedUsername.length < 3) {
    return { error: "username must be at least 3 characters" };
  }
  if (normalizedPassword.length < 8) {
    return { error: "password must be at least 8 characters" };
  }
  return { username: normalizedUsername, password: normalizedPassword };
}

function ensureServerAuthConfig() {
  const jwtConfig = getJwtConfig();
  if (!jwtConfig.secret) {
    return "JWT_SECRET is missing";
  }
  return null;
}

async function signup(req, res) {
  const { username, password } = req.body || {};
  const validation = validateCredentialInput(username, password);
  if (validation.error) {
    return res.status(400).json({ error: validation.error });
  }

  const configError = ensureServerAuthConfig();
  if (configError) {
    return res.status(500).json({ error: `Server auth configuration missing: ${configError}` });
  }

  try {
    await ensureAuthTable();
    const passwordHash = hashPassword(validation.password);
    const created = await pool.query(
      "INSERT INTO admin_users (username, password_hash) VALUES ($1, $2) RETURNING id, username",
      [validation.username, passwordHash]
    );
    const user = created.rows[0];
    const token = createAdminToken(user);
    return res.status(201).json({ token, user: { id: user.id, username: user.username, role: "admin" } });
  } catch (err) {
    if (err && err.code === "23505") {
      return res.status(409).json({ error: "username already exists" });
    }
    console.error(err);
    return res.status(500).json({ error: "Database error" });
  }
}

async function login(req, res) {
  const { username, password } = req.body || {};
  const validation = validateCredentialInput(username, password);
  if (validation.error) {
    return res.status(400).json({ error: validation.error });
  }

  const configError = ensureServerAuthConfig();
  if (configError) {
    return res.status(500).json({ error: `Server auth configuration missing: ${configError}` });
  }

  try {
    await ensureAuthTable();
    const result = await pool.query(
      "SELECT id, username, password_hash FROM admin_users WHERE username = $1",
      [validation.username]
    );

    if (result.rows.length > 0) {
      const user = result.rows[0];
      const ok = verifyPassword(validation.password, user.password_hash);
      if (!ok) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const token = createAdminToken(user);
      return res.json({ token, user: { id: user.id, username: user.username, role: "admin" } });
    }

    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (adminUsername && adminPassword && validation.username === adminUsername && validation.password === adminPassword) {
      const token = createAdminToken({ id: 0, username: adminUsername });
      return res.json({ token, user: { id: 0, username: adminUsername, role: "admin" } });
    }

    return res.status(401).json({ error: "Invalid credentials" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Database error" });
  }
}

function me(req, res) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  return res.json({
    user: {
      id: req.user.sub || null,
      username: req.user.username || "",
      role: req.user.role || "",
    },
  });
}

module.exports = { login, signup, me };
