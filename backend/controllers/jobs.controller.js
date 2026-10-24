const pool = require("../db/pool");

async function getAllJobs(req, res) {
  try {
    const result = await pool.query(
      "SELECT id, title, description FROM jobs ORDER BY id DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
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
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
}

async function createJob(req, res) {
  const title = (req.body.title || "").trim();
  const description = (req.body.description || "").trim();

  if (!title || !description) {
    return res.status(400).json({ error: "title and description are required" });
  }

  try {
    const result = await pool.query(
      "INSERT INTO jobs (title, description) VALUES ($1, $2) RETURNING id, title, description",
      [title, description]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
}

async function deleteJob(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Invalid job id" });
  }

  try {
    const result = await pool.query("DELETE FROM jobs WHERE id = $1 RETURNING id", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Job not found" });
    }
    return res.json({ deleted: true, id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Database error" });
  }
}

module.exports = { getAllJobs, getJobById, createJob, deleteJob };
