require("dotenv").config();
const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");
const pool = require("../db/pool");
const { dispatchBatch, pruneDeliveredEvents } = require("../services/outbox-dispatcher.cjs");

async function main() {
  if (process.env.AWS_EVENTS_ENABLED !== "true") throw new Error("AWS events are disabled");
  const region = process.env.AWS_REGION;
  const url = process.env.AWS_EVENT_QUEUE_URL;
  if (!region || !url) throw new Error("AWS_REGION and AWS_EVENT_QUEUE_URL are required");
  const queue = new URL(url);
  if (queue.protocol !== "https:" || !queue.hostname.endsWith(".amazonaws.com")
      || queue.hostname !== `sqs.${region}.amazonaws.com` || queue.search || queue.username || queue.password) {
    throw new Error("Expected a regional HTTPS AWS SQS queue URL");
  }
  const sqs = new SQSClient({ region, maxAttempts: 3,
    requestHandler: { connectionTimeout: 2000, requestTimeout: 5000 } });
  let stopping = false;
  const stop = () => { stopping = true; };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
  try {
    do {
      const stats = await dispatchBatch(pool, (event) => sqs.send(new SendMessageCommand({
        QueueUrl: url, MessageBody: JSON.stringify(event),
      }), { abortSignal: AbortSignal.timeout(10000) }));
      console.log(JSON.stringify({ event: "outbox_batch", ...stats }));
      await pruneDeliveredEvents(pool);
      if (process.argv.includes("--once") || stopping) break;
      await new Promise((resolve) => setTimeout(resolve, 10000));
    } while (!stopping);
  } finally {
    sqs.destroy();
    await pool.end();
  }
}
main().catch((error) => {
  console.error(JSON.stringify({ event: "outbox_worker_failed", code: error.name }));
  process.exitCode = 1;
});
