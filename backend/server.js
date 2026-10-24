require("dotenv").config();

const express = require("express");
const cors = require("cors");

const jobRoutes = require("./routes/jobs.routes");
const applicationRoutes = require("./routes/applications.routes");
const authRoutes = require("./routes/auth.routes");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ ok: true }));
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

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
