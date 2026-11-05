import "../src/env.js";
import { existsSync } from "node:fs";
import { backendEnvPath } from "../src/env.js";
import { verifyMailConfiguration } from "../src/email.js";
import { pool } from "../src/db.js";
// تم التعديل من عبير: نوضح ملف الاعدادات وسبب الفشل بدون طباعه البريد او الباسورد او رموز التحقق.
console.log("backend/.env:", existsSync(backendEnvPath) ? "found" : "not found using process or root environment");
try {
  await verifyMailConfiguration();
  console.log("PASS SMTP connection and authentication accepted This does not confirm delivery to the recipient inbox");
} catch (error) {
  const messages = {
    EAUTH: "Email service rejected credentials Check SMTP_USER and the sender app password in SMTP_PASS",
    EDNS: "SMTP hostname could not be resolved Check SMTP_HOST and DNS",
    ENOTFOUND: "SMTP hostname was not found Check SMTP_HOST",
    ECONNREFUSED: "SMTP connection refused Check SMTP_PORT and network access",
    ECONNECTION: "SMTP connection failed Check host port and network",
    ETIMEDOUT: "SMTP connection timed out Check port network or provider restrictions",
    ESOCKET: "SMTP secure connection failed Check port TLS certificates and network",
    EENVELOPE: "Sender address rejected Check MAIL_FROM and sender permissions",
    SMTP_HOST_INVALID: "SMTP_HOST must be a hostname such as smtp.gmail.com without https or a port",
    SMTP_PORT_INVALID: "SMTP_PORT must be a valid port number",
  };
  console.error("FAIL", error.code || "SMTP_ERROR");
  if (error.code === "SMTP_CONFIGURATION_MISSING") console.error("Missing settings:", error.missing.join(", "));
  else console.error(messages[error.code] || "Check SMTP settings and provider permissions");
  if (Number.isInteger(error.responseCode)) console.error("SMTP response code:", error.responseCode);
  process.exitCode = 1;
} finally { await pool.end(); }
