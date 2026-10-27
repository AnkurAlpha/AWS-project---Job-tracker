#!/usr/bin/env node
// Portable local setup. Hosting-specific deployment tooling lives separately.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "..");
const envPath = path.join(root, "backend", ".env");
const template = path.join(root, "backend", ".env.example");
let env = fs.readFileSync(fs.existsSync(envPath) ? envPath : template, "utf8");
const password = crypto.randomBytes(24).toString("base64url");
const values = {
  ADMIN_USERNAME: "sohom-admin",
  ADMIN_PASSWORD: password,
  ALLOW_ADMIN_SIGNUP: "false",
};
const currentJwt = env.match(/^JWT_SECRET=(.*)$/m)?.[1] || "";
if (currentJwt.length < 32 || /replace|example|change.?me/i.test(currentJwt)) {
  values.JWT_SECRET = crypto.randomBytes(48).toString("hex");
}
for (const [key, value] of Object.entries(values)) {
  const entry = new RegExp(`^${key}=.*$`, "m");
  env = entry.test(env) ? env.replace(entry, `${key}=${value}`) : `${env.trimEnd()}\n${key}=${value}\n`;
}
fs.writeFileSync(envPath, env, { mode: 0o600 });
fs.chmodSync(envPath, 0o600);
const loginPath = path.join(root, "PRIVATE-ADMIN-LOGIN.txt");
fs.writeFileSync(loginPath,
  "PRIVATE LOCAL APPLICATION LOGIN\n" +
  "Username: sohom-admin\n" +
  `Password: ${password}\n` +
  "Open /login on your local frontend. Restart the backend after setup.\n" +
  "This file is not an AWS IAM login and does not change a hosted application.\n",
  { mode: 0o600 });
fs.chmodSync(loginPath, 0o600);
console.log(`Local admin configured. Read ${loginPath} privately, then restart the backend.`);
