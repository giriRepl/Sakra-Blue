import {
  ExchangeService,
  EmailMessage,
  MessageBody,
  Uri,
  ExchangeCredentials,
  ExchangeVersion,
  BodyType,
} from "ews-javascript-api";

interface SendEmailResult {
  success: boolean;
  error?: string;
  messageId?: string;
}

function createExchangeService(): ExchangeService | null {
  const host = (process.env.SMTP_HOST || "").replace(/^https?:\/\//, "").trim();
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  const service = new ExchangeService(ExchangeVersion.Exchange2013);
  service.Credentials = new ExchangeCredentials(user, pass);
  service.Url = new Uri(`https://${host}/EWS/Exchange.asmx`);

  return service;
}

export async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<SendEmailResult> {
  const service = createExchangeService();
  if (!service) {
    return { success: false, error: "Email not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS." };
  }

  const host = (process.env.SMTP_HOST || "").replace(/^https?:\/\//, "").trim();

  try {
    const message = new EmailMessage(service);
    message.Subject = subject;
    message.Body = new MessageBody(BodyType.HTML, body);
    message.ToRecipients.Add(to);

    await message.Send();

    return { success: true, messageId: `ews-${Date.now()}` };
  } catch (error: any) {
    return {
      success: false,
      error: `EWS error (${host}) — ${error.message || "Failed to send email"}`,
    };
  }
}
