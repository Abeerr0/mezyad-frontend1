import "dotenv/config";
import { verifyMailConfiguration } from "../src/email.js";
import { pool } from "../src/db.js";
// تم التعديل من عبير: نفحص الاتصال بالبريد محليا ونظهر سبب عام بدون كلمات مرور او اكواد تحقق.
try {
  await verifyMailConfiguration();
  console.log(
    "PASS SMTP connection and authentication accepted Delivery still depends on the recipient provider",
  );
} catch (error) {
  const messages = {
    EAUTH: "SMTP credentials rejected Check the email app password",
    ECONNECTION: "SMTP connection failed Check host port and network",
    ETIMEDOUT: "SMTP timed out Check network and provider",
    ESOCKET: "SMTP secure connection failed",
  };
  console.error(
    "FAIL",
    messages[error.code] ||
      "Check SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS and provider configuration",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
