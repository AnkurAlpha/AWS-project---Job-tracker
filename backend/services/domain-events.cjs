const { randomUUID } = require("node:crypto");
const TYPES = new Set(["job.published", "job.deleted", "application.submitted",
  "application.status_changed", "application.deleted"]);
const ALLOWED = new Set(["job_id", "application_id", "status"]);

function makeEvent(type, payload, now = new Date()) {
  if (!TYPES.has(type)) throw new Error("Unknown event type");
  for (const key of Object.keys(payload)) {
    if (!ALLOWED.has(key)) throw new Error("Event field is not approved for cloud delivery");
  }
  for (const key of ["job_id", "application_id"]) {
    if (payload[key] !== undefined && (!Number.isSafeInteger(Number(payload[key])) || Number(payload[key]) <= 0)) {
      throw new Error("Invalid event identifier");
    }
  }
  if (payload.status !== undefined && !["applied", "interview", "passed"].includes(payload.status)) {
    throw new Error("Invalid event status");
  }
  if (payload.job_id === undefined || (type.startsWith("application.") && payload.application_id === undefined)) {
    throw new Error("Required event identifier missing");
  }
  if (["application.submitted", "application.status_changed"].includes(type) && payload.status === undefined) {
    throw new Error("Required application status missing");
  }
  const normalized = { ...payload };
  for (const key of ["job_id", "application_id"]) if (key in normalized) normalized[key] = Number(normalized[key]);
  return { schema_version: 1, event_id: randomUUID(), event_type: type,
    occurred_at: now.toISOString(), ...normalized };
}

async function withDomainEvent(pool, mutation, eventFactory, enabled = process.env.AWS_EVENTS_ENABLED === "true") {
  if (!enabled) return mutation(pool);
  const client = await pool.connect();
  let began = false;
  try {
    await client.query("BEGIN");
    began = true;
    const result = await mutation(client);
    const event = eventFactory(result);
    if (event) {
      await client.query("INSERT INTO cloud_outbox (event_id, event_type, payload) VALUES ($1, $2, $3::jsonb)",
        [event.event_id, event.event_type, JSON.stringify(event)]);
    }
    await client.query("COMMIT");
    return result;
  } catch (error) {
    if (began) await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
module.exports = { makeEvent, withDomainEvent };
