const { randomUUID } = require("node:crypto");

function securityHeaders(req, res, next) {
  res.setHeader("X-Request-ID", randomUUID());
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Frame-Options", "DENY");
  next();
}

function loginLimiter({ limit = 10, windowMs = 15 * 60 * 1000, maxEntries = 10000, now = Date.now } = {}) {
  const clients = new Map();
  return (req, res, next) => {
    const time = now();
    for (const [key, item] of clients) if (item.reset <= time) clients.delete(key);
    const key = req.ip || "unknown";
    let item = clients.get(key);
    if (!item) {
      if (clients.size >= maxEntries) return res.status(503).json({ error: "Please try again later" });
      item = { count: 0, reset: time + windowMs };
      clients.set(key, item);
    }
    if (++item.count > limit) {
      res.setHeader("Retry-After", String(Math.ceil((item.reset - time) / 1000)));
      return res.status(429).json({ error: "Too many login attempts. Please try again later." });
    }
    next();
  };
}
module.exports = { securityHeaders, loginLimiter };
