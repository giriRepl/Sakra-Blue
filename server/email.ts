import {
  ExchangeService,
  EmailMessage,
  MessageBody,
  Uri,
  ExchangeCredentials,
  ExchangeVersion,
  BodyType,
  ConfigurationApi,
} from "ews-javascript-api";

interface SendEmailResult {
  success: boolean;
  error?: string;
  messageId?: string;
}

function createExchangeService(): ExchangeService | null {
  const ewsUrl = process.env.EWS_URL;
  const ewsUser = process.env.EWS_USERNAME;
  const ewsPass = process.env.EWS_PASSWORD;
  const ewsDomain = process.env.EWS_DOMAIN || "";

  if (!ewsUrl || !ewsUser || !ewsPass) {
    return null;
  }

  ConfigurationApi.ConfigureXHR(new (require("xhr2"))());

  const service = new ExchangeService(ExchangeVersion.Exchange2013);

  const username = ewsDomain ? `${ewsDomain}\\${ewsUser}` : ewsUser;
  service.Credentials = new ExchangeCredentials(username, ewsPass);
  service.Url = new Uri(ewsUrl);

  return service;
}

export async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<SendEmailResult> {
  const service = createExchangeService();
  if (!service) {
    return { success: false, error: "EWS not configured. Set EWS_URL, EWS_USERNAME, EWS_PASSWORD." };
  }

  try {
    const message = new EmailMessage(service);
    message.Subject = subject;
    message.Body = new MessageBody(BodyType.HTML, body);
    message.ToRecipients.Add(to);

    await message.Send();

    return { success: true, messageId: `ews-${Date.now()}` };
  } catch (error: any) {
    const ewsUrl = process.env.EWS_URL || "";
    return {
      success: false,
      error: `EWS error (${ewsUrl}) — ${error.message || "Failed to send email"}`,
    };
  }
}
