import { storage } from "./storage";

const SMS_API_URL = "https://sakrasms-prod.napses.in/send-sms";

interface SendSmsResult {
  success: boolean;
  error?: string;
}

export async function sendSms(mobile: string, message: string, templateId: string, templateName?: string): Promise<SendSmsResult> {
  const apiSecret = process.env.SMS_API_SECRET;
  if (!apiSecret) {
    console.error("SMS_API_SECRET not configured");
    await logFailure(mobile, "SMS_API_SECRET not configured");
    await logSmsCall(mobile, message, templateName, "failed");
    return { success: false, error: "SMS credentials not configured" };
  }

  try {
    const response = await fetch(SMS_API_URL, {
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
      const reason = `SMS API returned HTTP ${response.status}: ${responseText}`;
      console.error("SMS send error:", reason);
      await logFailure(mobile, reason);
      await logSmsCall(mobile, message, templateName, "failed");
      return { success: false, error: reason };
    }

    console.log(`SMS sent to ***${mobile.slice(-4)}: ${responseText}`);
    await logSmsCall(mobile, message, templateName, "sent");
    return { success: true };
  } catch (error: any) {
    const reason = `SMS send exception: ${error.message || "Unknown error"}`;
    console.error(reason);
    await logFailure(mobile, reason);
    await logSmsCall(mobile, message, templateName, "failed");
    return { success: false, error: reason };
  }
}

async function logSmsCall(mobile: string, message: string, templateName: string | undefined, status: string) {
  try {
    await storage.createSmsLog({
      mobile,
      message,
      templateName: templateName || null,
      status,
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
