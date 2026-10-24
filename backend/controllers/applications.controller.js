const pool = require("../db/pool");

const ALLOWED_STATUSES = new Set(["applied", "interview", "passed"]);

async function ensureApplicationStatusColumn() {
  await pool.query(
    "ALTER TABLE applications ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'applied'"
  );
}

async function createApplication(req, res) {
  const jobId = Number(req.body.jobId);
  const name = (req.body.name || "").trim();
  const email = (req.body.email || "").trim();
  const resume = (req.body.resume || "").trim();

  if (!Number.isInteger(jobId) || jobId <= 0 || !name || !email || !resume) {
    return res.status(400).json({ error: "jobId, name, email and resume are required" });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  try {
    await ensureApplicationStatusColumn();

    const jobExists = await pool.query("SELECT id FROM jobs WHERE id = $1", [jobId]);
    if (jobExists.rows.length === 0) {
      return res.status(404).json({ error: "Job not found" });
    }

    const result = await pool.query(
      `INSERT INTO applications (job_id, name, email, resume, status)
        VALUES ($1, $2, $3, $4, 'applied')
        RETURNING id, job_id AS "jobId", name, email, resume, status, created_at
        AS "createdAt"`,
      [jobId, name, email, resume]
    );
    res.status(201).json({ message: "Application submitted", application: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
}

async function listApplications(req, res) {
  try {
    await ensureApplicationStatusColumn();

    const result = await pool.query(
      `SELECT
        a.id,
        a.job_id AS "jobId",
        a.name,
        a.email,
        a.resume,
        a.status,
        a.created_at AS "createdAt",
        j.title AS "jobTitle"
     FROM applications a
     JOIN jobs j ON j.id = a.job_id
     ORDER BY a.id DESC`
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
}

async function updateApplicationStatus(req, res) {
  const id = Number(req.params.id);
  const status = (req.body.status || "").trim().toLowerCase();

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid application id" });
  }

  if (!ALLOWED_STATUSES.has(status)) {
    return res.status(400).json({ error: "Invalid status. Allowed: applied, interview, passed" });
  }

  try {
    await ensureApplicationStatusColumn();

    const result = await pool.query(
      `UPDATE applications
       SET status = $1
       WHERE id = $2
       RETURNING id, job_id AS "jobId", name, email, resume, status, created_at AS "createdAt"`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Application not found" });
    }

    return res.json({ updated: true, application: result.rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Database error" });
  }
}

async function deleteApplication(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid application id" });
  }

  try {
    const result = await pool.query("DELETE FROM applications WHERE id = $1 RETURNING id", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Application not found" });
    }
    return res.json({ deleted: true, id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Database error" });
  }
}

module.exports = { createApplication, listApplications, updateApplicationStatus, deleteApplication };
