const jwt = require("jsonwebtoken");

const DEFAULT_EXPIRES_IN = "12h";
const DEFAULT_ISSUER = "job-tracker-api";
const DEFAULT_AUDIENCE = "job-tracker-admin";

function getJwtConfig() {
  const secret = process.env.JWT_SECRET;
  return {
    secret,
    expiresIn: process.env.JWT_EXPIRES_IN || DEFAULT_EXPIRES_IN,
    issuer: process.env.JWT_ISSUER || DEFAULT_ISSUER,
    audience: process.env.JWT_AUDIENCE || DEFAULT_AUDIENCE,
  };
}

function createAdminToken(user) {
  const config = getJwtConfig();
  if (!config.secret) {
    throw new Error("JWT secret missing");
  }

  return jwt.sign(
    { sub: String(user.id), username: user.username, role: "admin" },
    config.secret,
    {
      expiresIn: config.expiresIn,
      issuer: config.issuer,
      audience: config.audience,
      algorithm: "HS256",
    }
  );
}

function verifyAccessToken(token) {
  const config = getJwtConfig();
  if (!config.secret) {
    throw new Error("JWT secret missing");
  }

  return jwt.verify(token, config.secret, {
    algorithms: ["HS256"],
    issuer: config.issuer,
    audience: config.audience,
  });
}

module.exports = { getJwtConfig, createAdminToken, verifyAccessToken };
