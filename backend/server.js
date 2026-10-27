require("dotenv").config();

const express = require("express");
const cors = require("cors");
const pool = require("./db/pool");

const jobRoutes = require("./routes/jobs.routes");
const applicationRoutes = require("./routes/applications.routes");
const authRoutes = require("./routes/auth.routes");

const app = express();
const PORT = process.env.PORT || 5000;

app.disable("x-powered-by");
app.set("trust proxy", 1);
if (process.env.NODE_ENV !== "production") {
  app.use(cors({ origin: /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/ }));
}
app.use(express.json({ limit: "64kb" }));

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

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({ error: "Internal server error" });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
