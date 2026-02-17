import nodemailer from "nodemailer";

interface SendEmailResult {
  success: boolean;
  error?: string;
  messageId?: string;
}

function createTransporter() {
  const host = (process.env.SMTP_HOST || "").replace(/^https?:\/\//, "").trim();
  const port = parseInt(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 15000,
    tls: {
      rejectUnauthorized: false,
    },
  });
}

export async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<SendEmailResult> {
  const transporter = createTransporter();
  if (!transporter) {
    return { success: false, error: "SMTP not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS." };
  }

  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;
  const host = (process.env.SMTP_HOST || "").replace(/^https?:\/\//, "").trim();
  const port = process.env.SMTP_PORT || "587";

  try {
    await transporter.verify();
  } catch (error: any) {
    return {
      success: false,
      error: `Cannot connect to SMTP server ${host}:${port} — ${error.message}. Try port 465 (SSL) or check if the mail server allows external connections.`,
    };
  }

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      html: body,
    });

    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to send email" };
  }
}
