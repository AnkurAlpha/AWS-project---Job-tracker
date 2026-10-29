const { logError } = require("../utils/log-error.cjs");
const pool = require("../db/pool");
const { makeEvent, withDomainEvent } = require("../services/domain-events.cjs");

const ALLOWED_STATUSES = new Set(["applied", "interview", "passed"]);

async function ensureApplicationStatusColumn() {
  await pool.query(
    "ALTER TABLE applications ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'applied'"
  );
}

async function createApplication(req, res) {
  const jobId = Number(req.body?.jobId);
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const resume = typeof req.body?.resume === "string" ? req.body.resume.trim() : "";

  if (!Number.isSafeInteger(jobId) || jobId <= 0 || !name || !email || !resume
      || name.length > 200 || email.length > 254 || resume.length > 10000) {
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

    const result = await withDomainEvent(pool, (db) => db.query(
      `INSERT INTO applications (job_id, name, email, resume, status)
        VALUES ($1, $2, $3, $4, 'applied')
        RETURNING id, job_id AS "jobId", name, email, resume, status, created_at
        AS "createdAt"`,
      [jobId, name, email, resume]
    ), (r) => makeEvent("application.submitted", {
      job_id: r.rows[0].jobId, application_id: r.rows[0].id, status: "applied",
    }));
    res.status(201).json({ message: "Application submitted", application: result.rows[0] });
  } catch (err) {
    logError(err);
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
    logError(err);
    res.status(500).json({ error: "Database error" });
  }
}

async function updateApplicationStatus(req, res) {
  const id = Number(req.params.id);
  const status = typeof req.body?.status === "string" ? req.body.status.trim().toLowerCase() : "";

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid application id" });
  }

  if (!ALLOWED_STATUSES.has(status)) {
    return res.status(400).json({ error: "Invalid status. Allowed: applied, interview, passed" });
  }

  try {
    await ensureApplicationStatusColumn();

    const result = await withDomainEvent(pool, (db) => db.query(
      `UPDATE applications
       SET status = $1
       WHERE id = $2
       RETURNING id, job_id AS "jobId", name, email, resume, status, created_at AS "createdAt"`,
      [status, id]
    ), (r) => r.rows[0] ? makeEvent("application.status_changed", {
      job_id: r.rows[0].jobId, application_id: r.rows[0].id, status: r.rows[0].status,
    }) : null);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Application not found" });
    }

    return res.json({ updated: true, application: result.rows[0] });
  } catch (err) {
    logError(err);
    return res.status(500).json({ error: "Database error" });
  }
}

async function deleteApplication(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid application id" });
  }

  try {
    const result = await withDomainEvent(pool,
      (db) => db.query("DELETE FROM applications WHERE id = $1 RETURNING id, job_id", [id]),
      (r) => r.rows[0] ? makeEvent("application.deleted", {
        job_id: r.rows[0].job_id, application_id: r.rows[0].id,
      }) : null);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Application not found" });
    }
    return res.json({ deleted: true, id });
  } catch (err) {
    logError(err);
    return res.status(500).json({ error: "Database error" });
  }
}

module.exports = { createApplication, listApplications, updateApplicationStatus, deleteApplication };
