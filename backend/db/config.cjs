const fs = require("node:fs");

function databaseConfig(env = process.env, readFile = fs.readFileSync) {
  const config = { connectionString: env.DATABASE_URL, max: 5,
    connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000, query_timeout: 15000 };
  if (env.DATABASE_SSL === "true") {
    const uri = new URL(env.DATABASE_URL);
    for (const field of ["sslmode", "sslcert", "sslkey", "sslrootcert"]) {
      if (uri.searchParams.has(field)) throw new Error("Use DATABASE_SSL_CA_FILE instead of URL SSL overrides");
    }
    if (!env.DATABASE_SSL_CA_FILE) throw new Error("A trusted database CA file is required for managed TLS");
    config.ssl = { ca: readFile(env.DATABASE_SSL_CA_FILE, "utf8"), rejectUnauthorized: true };
  }
  return config;
}
module.exports = { databaseConfig };
