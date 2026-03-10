import { storage } from "./storage";

const PRIMARY_SMS_URL = "https://sakrasms-prod.napses.in/send-sms";
const SECONDARY_SMS_URL = "http://164.52.203.149/send-sms";

interface SendSmsResult {
  success: boolean;
  error?: string;
  serverUsed?: "primary" | "secondary";
}

async function attemptSmsSend(
  url: string,
  apiSecret: string,
  mobile: string,
  message: string,
  templateId: string
): Promise<{ ok: boolean; responseText: string; httpStatus?: number }> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: apiSecret,
        mobile,
        text: message,
        templateId,
      }),
    });

    const responseText = await response.text();

    if (!response.ok) {
      return { ok: false, responseText: `HTTP ${response.status}: ${responseText}`, httpStatus: response.status };
    }

    return { ok: true, responseText };
  } catch (error: any) {
    return { ok: false, responseText: `Exception: ${error.message || "Unknown error"}` };
  }
}

export async function sendSms(mobile: string, message: string, templateId: string, templateName?: string): Promise<SendSmsResult> {
  const apiSecret = process.env.SMS_API_SECRET;
  if (!apiSecret) {
    console.error("SMS_API_SECRET not configured");
    await logFailure(mobile, "SMS_API_SECRET not configured");
    await logSmsCall(mobile, message, templateName, templateId, "failed", "SMS_API_SECRET not configured", null);
    return { success: false, error: "SMS credentials not configured" };
  }

  const primaryResult = await attemptSmsSend(PRIMARY_SMS_URL, apiSecret, mobile, message, templateId);

  if (primaryResult.ok) {
    console.log(`SMS sent via primary to ***${mobile.slice(-4)}: ${primaryResult.responseText}`);
    await logSmsCall(mobile, message, templateName, templateId, "sent", primaryResult.responseText, "primary");
    return { success: true, serverUsed: "primary" };
  }

  console.warn(`SMS primary failed for ***${mobile.slice(-4)}: ${primaryResult.responseText}. Trying secondary...`);

  const secondaryResult = await attemptSmsSend(SECONDARY_SMS_URL, apiSecret, mobile, message, templateId);

  if (secondaryResult.ok) {
    console.log(`SMS sent via secondary to ***${mobile.slice(-4)}: ${secondaryResult.responseText}`);
    await logSmsCall(mobile, message, templateName, templateId, "sent", secondaryResult.responseText, "secondary");
    return { success: true, serverUsed: "secondary" };
  }

  const reason = `Primary: ${primaryResult.responseText} | Secondary: ${secondaryResult.responseText}`;
  console.error(`SMS failed on both servers for ***${mobile.slice(-4)}: ${reason}`);
  await logFailure(mobile, reason);
  await logSmsCall(mobile, message, templateName, templateId, "failed", reason, "both_failed");
  return { success: false, error: reason };
}

async function logSmsCall(
  mobile: string,
  message: string,
  templateName: string | undefined,
  templateId: string | undefined,
  status: string,
  apiResponse?: string,
  serverUsed?: string | null
) {
  try {
    await storage.createSmsLog({
      mobile,
      message,
      templateName: templateName || null,
      templateId: templateId || null,
      status,
      apiResponse: apiResponse || null,
      serverUsed: serverUsed || null,
    });
  } catch (e) {
    console.error("Failed to log SMS call:", e);
  }
}

async function logFailure(mobile: string, reason: string) {
  try {
    await storage.createSmsFailureLog({
      mobileLast4: mobile.slice(-4),
      reason,
    });
  } catch (e) {
    console.error("Failed to log SMS failure:", e);
  }
}

export async function sendTemplatedSms(
  mobile: string,
  templateName: string,
  replacements: Record<string, string>
): Promise<SendSmsResult> {
  const template = await storage.getSmsTemplateByName(templateName);
  if (!template) {
    const reason = `SMS template "${templateName}" not found in database`;
    console.error(reason);
    await logFailure(mobile, reason);
    return { success: false, error: reason };
  }

  let message = template.text;
  for (const [placeholder, value] of Object.entries(replacements)) {
    message = message.replace(new RegExp(placeholder.replace(/[{}#]/g, "\\$&"), "g"), value);
  }

  message = message.replace(/\{#[^#]*#\}/g, "");
  message = message.replace(/\s{2,}/g, " ").trim();

  return sendSms(mobile, message, template.templateId, templateName);
}

export function generateNumericOtp(length: number = 4): string {
  let otp = "";
  for (let i = 0; i < length; i++) {
    otp += Math.floor(Math.random() * 10).toString();
  }
  if (otp[0] === "0") otp = (Math.floor(Math.random() * 9) + 1).toString() + otp.slice(1);
  return otp;
}
