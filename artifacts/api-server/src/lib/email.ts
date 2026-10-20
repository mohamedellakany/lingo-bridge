import nodemailer, { type Transporter } from "nodemailer";
import { logger } from "./logger";

let transporter: Transporter | null = null;
let transportResolved = false;

/**
 * Builds an SMTP transport from environment variables. Returns null when SMTP
 * is not configured, in which case the caller falls back to logging the email
 * (useful for local development without a mail provider).
 *
 * Required env vars for real sending:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
 * Optional:
 *   SMTP_SECURE ("true" to force TLS on connect, defaults based on port 465)
 *   SMTP_FROM   (the From address; defaults to SMTP_USER)
 */
function getTransporter(): Transporter | null {
  if (transportResolved) return transporter;
  transportResolved = true;

  const host = process.env["SMTP_HOST"];
  const port = process.env["SMTP_PORT"];
  const user = process.env["SMTP_USER"];
  const pass = process.env["SMTP_PASS"];

  if (!host || !port || !user || !pass) {
    logger.warn(
      "SMTP is not configured — OTP emails will be logged to the console instead of sent. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS to enable real email.",
    );
    transporter = null;
    return transporter;
  }

  const portNum = Number(port);
  const secure =
    process.env["SMTP_SECURE"] === "true" || portNum === 465;

  transporter = nodemailer.createTransport({
    host,
    port: portNum,
    secure,
    auth: { user, pass },
  });

  return transporter;
}

function fromAddress(): string {
  return (
    process.env["SMTP_FROM"] ||
    process.env["SMTP_USER"] ||
    "no-reply@lingobridge.app"
  );
}

/**
 * Sends a verification code to the given email address. When SMTP is not
 * configured, logs the code instead so the signup flow can still be tested.
 */
export async function sendOtpEmail(
  to: string,
  code: string,
): Promise<void> {
  const subject = "Your LingoBridge verification code";
  const text = `Your LingoBridge verification code is ${code}. It expires in 10 minutes. If you did not request this, you can ignore this email.`;
  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 420px; margin: 0 auto; padding: 24px;">
      <h2 style="color:#09101F; margin:0 0 8px;">Verify your email</h2>
      <p style="color:#4A5568; font-size:14px; line-height:1.5;">
        Use this code to finish creating your LingoBridge account:
      </p>
      <div style="font-size:32px; font-weight:700; letter-spacing:8px; color:#5B8AF5; background:#F1F5FF; border-radius:12px; padding:16px; text-align:center; margin:16px 0;">
        ${code}
      </div>
      <p style="color:#94A3B8; font-size:12px;">
        This code expires in 10 minutes. If you did not request it, ignore this email.
      </p>
    </div>`;

  const tx = getTransporter();

  if (!tx) {
    // Dev fallback: no SMTP configured.
    logger.info({ to, code }, `[DEV] OTP for ${to}: ${code}`);
    return;
  }

  await tx.sendMail({ from: fromAddress(), to, subject, text, html });
  logger.info({ to }, "OTP email sent");
}
