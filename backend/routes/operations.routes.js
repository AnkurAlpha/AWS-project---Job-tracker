const router = require("express").Router();
const pool = require("../db/pool");
const { verifyToken, requireAdmin } = require("../middleware/auth.middleware");

router.get("/events", verifyToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`SELECT
      COUNT(*) FILTER (WHERE dispatched_at IS NULL AND dead_lettered_at IS NULL)::int AS pending,
      COUNT(*) FILTER (WHERE dispatched_at IS NOT NULL)::int AS delivered,
      COUNT(*) FILTER (WHERE dead_lettered_at IS NOT NULL)::int AS "deadLettered"
      FROM cloud_outbox`);
    return res.json({ enabled: process.env.AWS_EVENTS_ENABLED === "true", ...result.rows[0] });
  } catch {
    return res.status(503).json({ error: "Event delivery status unavailable" });
  }
});
module.exports = router;
