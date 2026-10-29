require("dotenv").config();

const express = require("express");
const cors = require("cors");
const pool = require("./db/pool");
const { securityHeaders, loginLimiter } = require("./middleware/security.cjs");
const { migrate } = require("./db/migrate.cjs");

const jobRoutes = require("./routes/jobs.routes");
const applicationRoutes = require("./routes/applications.routes");
const authRoutes = require("./routes/auth.routes");

const app = express();
const PORT = process.env.PORT || 5000;

app.disable("x-powered-by");
app.set("trust proxy", process.env.TRUST_PROXY_HOPS === "1" ? 1 : false);
app.use(securityHeaders);
if (process.env.NODE_ENV !== "production") {
  app.use(cors({ origin: /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/ }));
}
app.use(express.json({ limit: "64kb" }));
app.post("/auth/login", loginLimiter());
app.post("/auth/signup", loginLimiter());
app.get("/live", (req, res) => res.json({ ok: true }));

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, database: "ready" });
  } catch {
    res.status(503).json({ ok: false, database: "unavailable" });
  }
});
app.use("/jobs", jobRoutes);
app.use("/applications", applicationRoutes);
app.use("/auth", authRoutes);
app.use("/operations", require("./routes/operations.routes"));

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error(JSON.stringify({ event: "request_error", code: err.name, request_id: res.getHeader("X-Request-ID") }));
  if (res.headersSent) {
    return next(err);
  }
  const status = err.type === "entity.too.large" ? 413 : err instanceof SyntaxError ? 400 : 500;
  res.status(status).json({ error: status === 500 ? "Internal server error" : "Invalid request body" });
});

if (require.main === module) {
  migrate(pool).then(() => {
    const server = app.listen(PORT, process.env.BIND_HOST || "127.0.0.1", () => console.log(`Server running on port ${PORT}`));
    const shutdown = () => {
      server.close(() => pool.end().then(() => process.exit(0)).catch(() => process.exit(1)));
      setTimeout(() => process.exit(1), 15000).unref();
    };
    process.once("SIGTERM", shutdown);
    process.once("SIGINT", shutdown);
  }).catch((error) => {
    console.error(JSON.stringify({ event: "database_migration_failed", code: error.name }));
    pool.end().finally(() => { process.exitCode = 1; });
  });
}

module.exports = app;
