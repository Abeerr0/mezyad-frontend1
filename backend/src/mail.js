import "./config.js";
import nodemailer from "nodemailer";

// تم التعديل من عبير: نرسل الرمز للبريد فعليا وما نطبعه باللوق ولا نرجعه للواجهه.
export function mailSettings() {
  if (
    !process.env.SMTP_HOST ||
    !process.env.MAIL_FROM ||
    (process.env.EMAIL_OTP_SECRET || "").length < 32
  )
    throw Object.assign(new Error("Configure SMTP and EMAIL_OTP_SECRET"), {
      status: 503,
      apiCode: "EMAIL_UNAVAILABLE",
    });
  const local = ["localhost", "127.0.0.1", "::1"].includes(
    process.env.SMTP_HOST,
  );
  return {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    requireTLS: !local && process.env.SMTP_SECURE !== "true",
    ...(process.env.SMTP_USER
      ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } }
      : {}),
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  };
}
export async function sendCode(email, code, purpose) {
  const transport = nodemailer.createTransport(mailSettings());
  try {
    const result = await transport.sendMail({
      from: process.env.MAIL_FROM,
      to: email,
      subject:
        purpose === "SIGNUP" ? "رمز التحقق لحساب مزياد" : "استعادة حساب مزياد",
      text: `رمزك في مزياد: ${code}\nالرمز صالح لمدة 10 دقائق. لا تشاركه مع أحد.\nإذا ما طلبت الرمز، تجاهل الرسالة.`,
    });
    if (!result.accepted?.length) throw new Error("Email not accepted");
  } catch {
    throw Object.assign(new Error("Email delivery unavailable"), {
      status: 503,
      apiCode: "EMAIL_UNAVAILABLE",
    });
  } finally {
    transport.close();
  }
}
