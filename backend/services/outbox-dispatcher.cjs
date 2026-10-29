const { randomUUID } = require("node:crypto");

async function dispatchBatch(pool, send, { batchSize = 10, maxAttempts = 12 } = {}) {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 10) throw new Error("Invalid batch size");
  const lease = randomUUID();
  const result = await pool.query(`UPDATE cloud_outbox SET
      lease_token = $1, leased_until = NOW() + INTERVAL '300 seconds', attempts = attempts + 1
    WHERE event_id IN (
      SELECT event_id FROM cloud_outbox WHERE dispatched_at IS NULL AND dead_lettered_at IS NULL
        AND available_at <= NOW() AND (leased_until IS NULL OR leased_until < NOW())
      ORDER BY created_at LIMIT $2 FOR UPDATE SKIP LOCKED)
    RETURNING event_id, payload, attempts`, [lease, batchSize]);
  const stats = { claimed: result.rows.length, sent: 0, retried: 0, deadLettered: 0 };
  for (const row of result.rows) {
    try {
      await send(row.payload);
      await pool.query(`UPDATE cloud_outbox SET dispatched_at = NOW(), lease_token = NULL,
        leased_until = NULL, last_error_code = NULL WHERE event_id = $1 AND lease_token = $2`, [row.event_id, lease]);
      stats.sent++;
    } catch (error) {
      const code = String(error.name || "DeliveryError").replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 100);
      await pool.query(`UPDATE cloud_outbox SET lease_token = NULL, leased_until = NULL,
        available_at = NOW() + ($3 * INTERVAL '1 second'), last_error_code = $4,
        dead_lettered_at = CASE WHEN attempts >= $5 THEN NOW() ELSE NULL END
        WHERE event_id = $1 AND lease_token = $2`,
      [row.event_id, lease, Math.min(3600, 2 ** Math.min(row.attempts, 12)), code, maxAttempts]);
      if (row.attempts >= maxAttempts) stats.deadLettered++;
      else stats.retried++;
    }
  }
  return stats;
}

async function pruneDeliveredEvents(pool) {
  // Bounded cleanup; never touches jobs, applications, private login data or backups.
  return pool.query(`DELETE FROM cloud_outbox WHERE event_id IN (
    SELECT event_id FROM cloud_outbox
    WHERE dispatched_at < NOW() - INTERVAL '7 days'
       OR dead_lettered_at < NOW() - INTERVAL '14 days'
    LIMIT 100)`);
}
module.exports = { dispatchBatch, pruneDeliveredEvents };
