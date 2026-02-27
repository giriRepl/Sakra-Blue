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

let xhrConfigured = false;

function createExchangeService(): ExchangeService | null {
  const ewsUrl = process.env.EWS_URL;
  const ewsUser = process.env.EWS_USERNAME;
  const ewsPass = process.env.EWS_PASSWORD;
  const ewsDomain = process.env.EWS_DOMAIN || "";

  if (!ewsUrl || !ewsUser || !ewsPass) {
    console.log("[EWS] Missing config — EWS_URL:", !!ewsUrl, "EWS_USERNAME:", !!ewsUser, "EWS_PASSWORD:", !!ewsPass);
    return null;
  }

  if (!xhrConfigured) {
    try {
      const xhr2 = require("xhr2");
      ConfigurationApi.ConfigureXHR(new xhr2());
      xhrConfigured = true;
    } catch (e: any) {
      console.error("[EWS] Failed to configure XHR:", e.message);
    }
  }

  const service = new ExchangeService(ExchangeVersion.Exchange2013);

  const username = ewsDomain ? `${ewsDomain}\\${ewsUser}` : ewsUser;
  service.Credentials = new ExchangeCredentials(username, ewsPass);
  service.Url = new Uri(ewsUrl);

  console.log("[EWS] Service created — URL:", ewsUrl, "User:", ewsDomain ? `${ewsDomain}\\***` : "***");

  return service;
}

export async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<SendEmailResult> {
  try {
    const service = createExchangeService();
    if (!service) {
      return { success: false, error: "EWS not configured. Set EWS_URL, EWS_USERNAME, EWS_PASSWORD." };
    }

    const message = new EmailMessage(service);
    message.Subject = subject;
    message.Body = new MessageBody(BodyType.HTML, body);
    message.ToRecipients.Add(to);

    console.log("[EWS] Sending email to:", to, "Subject:", subject);
    await message.Send();
    console.log("[EWS] Email sent successfully");

    return { success: true, messageId: `ews-${Date.now()}` };
  } catch (error: any) {
    const ewsUrl = process.env.EWS_URL || "";
    const errMsg = error?.message || error?.toString?.() || "Unknown error";
    console.error("[EWS] Send failed:", errMsg);
    if (error?.stack) console.error("[EWS] Stack:", error.stack);
    return {
      success: false,
      error: `EWS error (${ewsUrl}) — ${errMsg}`,
    };
  }
}
