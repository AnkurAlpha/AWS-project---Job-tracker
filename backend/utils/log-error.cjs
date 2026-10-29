function logError(error) {
  const safe = (value) => String(value || "Unknown").replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 60);
  console.error(JSON.stringify({ event: "database_operation_failed", type: safe(error?.name), code: safe(error?.code) }));
}
module.exports = { logError };
