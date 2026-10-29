const { logError } = require("../utils/log-error.cjs");
const pool = require("../db/pool");
const { makeEvent, withDomainEvent } = require("../services/domain-events.cjs");

async function getAllJobs(req, res) {
  try {
    const result = await pool.query(
      "SELECT id, title, description FROM jobs ORDER BY id DESC"
    );
    res.json(result.rows);
  } catch (err) {
    logError(err);
    res.status(500).json({ error: "Database error" });
  }
}

async function getJobById(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Invalid job id" });
  }
  try {
    const result = await pool.query(
      "SELECT id, title, description FROM jobs WHERE id = $1",
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Job not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    logError(err);
    res.status(500).json({ error: "Database error" });
  }
}

async function createJob(req, res) {
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  const description = typeof req.body?.description === "string" ? req.body.description.trim() : "";

  if (!title || !description || title.length > 200 || description.length > 10000) {
    return res.status(400).json({ error: "title and description are required" });
  }

  try {
    const result = await withDomainEvent(pool, (db) => db.query(
      "INSERT INTO jobs (title, description) VALUES ($1, $2) RETURNING id, title, description",
      [title, description]
    ), (r) => makeEvent("job.published", { job_id: r.rows[0].id }));
    res.status(201).json(result.rows[0]);
  } catch (err) {
    logError(err);
    res.status(500).json({ error: "Database error" });
  }
}

async function deleteJob(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Invalid job id" });
  }

  try {
    const result = await withDomainEvent(pool,
      (db) => db.query("DELETE FROM jobs WHERE id = $1 RETURNING id", [id]),
      (r) => r.rows[0] ? makeEvent("job.deleted", { job_id: r.rows[0].id }) : null);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Job not found" });
    }
    return res.json({ deleted: true, id });
  } catch (err) {
    logError(err);
    return res.status(500).json({ error: "Database error" });
  }
}

module.exports = { getAllJobs, getJobById, createJob, deleteJob };
