const crypto = require("crypto");

const ITERATIONS = 120000;
const KEYLEN = 64;
const DIGEST = "sha512";

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const derived = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST).toString("hex");
  return "pbkdf2$" + DIGEST + "$" + ITERATIONS + "$" + salt + "$" + derived;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== "string") return false;
  const parts = storedHash.split("$");
  if (parts.length !== 5 || parts[0] !== "pbkdf2") return false;

  const digest = parts[1];
  const iterations = Number(parts[2]);
  const salt = parts[3];
  const expected = parts[4];

  if (!digest || !Number.isInteger(iterations) || iterations <= 0 || !salt || !expected) {
    return false;
  }

  const actual = crypto.pbkdf2Sync(password, salt, iterations, expected.length / 2, digest).toString("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

module.exports = { hashPassword, verifyPassword };
