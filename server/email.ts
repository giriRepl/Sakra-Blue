import nodemailer from "nodemailer";
import xhr2 from "xhr2";
import {
  ExchangeService,
  EmailMessage,
  MessageBody,
  Uri,
  WebCredentials,
  ExchangeVersion,
  BodyType,
  ConfigurationApi,
  XhrApi,
} from "ews-javascript-api";

interface SendEmailResult {
  success: boolean;
  error?: string;
  messageId?: string;
  method?: "smtp" | "ews";
  details?: string;
}

interface EmailDto {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  isHtml?: boolean;
}

const exchangeVersionMap: Record<string, ExchangeVersion> = {
  Exchange2007_SP1: ExchangeVersion.Exchange2007_SP1,
  Exchange2010: ExchangeVersion.Exchange2010,
  Exchange2010_SP1: ExchangeVersion.Exchange2010_SP1,
  Exchange2010_SP2: ExchangeVersion.Exchange2010_SP2,
  Exchange2013: ExchangeVersion.Exchange2013,
  Exchange2013_SP1: ExchangeVersion.Exchange2013_SP1,
  Exchange2015: ExchangeVersion.Exchange2015,
  Exchange2016: ExchangeVersion.Exchange2016,
};

function getSmtpConfig() {
  const host = (process.env.SMTP_HOST || "").replace(/^https?:\/\//, "").trim();
  const portStr = (process.env.SMTP_PORT || "587").trim();
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || process.env.FROM_EMAIL || user;

  if (!host || !user || !pass) return null;

  const port = parseInt(portStr) || 587;
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  const rejectUnauthorized = process.env.SMTP_REJECT_UNAUTHORIZED !== "false";

  return { host, port, secure, user, pass, from, rejectUnauthorized };
}

function getEwsConfig() {
  const ewsUrl = process.env.EWS_URL;
  const ewsUser = process.env.EWS_USERNAME;
  const ewsPass = process.env.EWS_PASSWORD;
  const ewsDomain = process.env.EWS_DOMAIN || "";
  const authType = (process.env.EWS_AUTH_TYPE || "auto").toLowerCase();
  const rejectUnauthorized = process.env.EWS_REJECT_UNAUTHORIZED !== "false";
  const versionKey = process.env.EWS_EXCHANGE_VERSION || "Exchange2016";
  const version = exchangeVersionMap[versionKey] || ExchangeVersion.Exchange2016;
  const from = process.env.SMTP_FROM || process.env.FROM_EMAIL || ewsUser || "";

  if (!ewsUrl || !ewsUser || !ewsPass) return null;

  return { ewsUrl, ewsUser, ewsPass, ewsDomain, authType, rejectUnauthorized, version, from };
}

async function sendViaSmtp(dto: EmailDto): Promise<SendEmailResult> {
  const config = getSmtpConfig();
  if (!config) {
    return { success: false, error: "SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS.", method: "smtp" };
  }

  console.log("[SMTP] Attempting — Host:", config.host, "Port:", config.port, "Secure:", config.secure);

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    tls: { rejectUnauthorized: config.rejectUnauthorized },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 15000,
  });

  try {
    await transporter.verify();
    console.log("[SMTP] Connection verified");
  } catch (error: any) {
    console.error("[SMTP] Verify failed:", error.message);
    return {
      success: false,
      error: `SMTP connection failed (${config.host}:${config.port}) — ${error.message}`,
      method: "smtp",
    };
  }

  try {
    const mailOptions: any = {
      from: config.from,
      to: dto.to,
      subject: dto.subject,
    };

    if (dto.isHtml !== false) {
      mailOptions.html = dto.body;
    } else {
      mailOptions.text = dto.body;
    }

    if (dto.cc) mailOptions.cc = dto.cc;
    if (dto.bcc) mailOptions.bcc = dto.bcc;

    const info = await transporter.sendMail(mailOptions);
    console.log("[SMTP] Email sent successfully, messageId:", info.messageId);
    return { success: true, messageId: info.messageId, method: "smtp" };
  } catch (error: any) {
    console.error("[SMTP] Send failed:", error.message);
    return {
      success: false,
      error: `SMTP send failed — ${error.message}`,
      method: "smtp",
    };
  }
}

function deriveUsernameVariants(ewsUser: string, ewsDomain: string, fromEmail: string): string[] {
  const variants: string[] = [];
  const seen = new Set<string>();

  const addVariant = (v: string) => {
    const lower = v.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      variants.push(v);
    }
  };

  addVariant(ewsUser);

  let localPart = ewsUser;
  let emailDomain = "";

  if (ewsUser.includes("@")) {
    localPart = ewsUser.split("@")[0];
    emailDomain = ewsUser.split("@")[1];
    addVariant(localPart);
  }

  if (ewsDomain) {
    addVariant(`${ewsDomain}\\${localPart}`);
  }

  if (!emailDomain && fromEmail && fromEmail.includes("@")) {
    emailDomain = fromEmail.split("@")[1];
  }
  if (emailDomain && !ewsUser.includes("@")) {
    addVariant(`${localPart}@${emailDomain}`);
  }

  return variants;
}

function getAuthModes(authType: string): string[] {
  if (authType === "auto") return ["ntlm", "basic", "cookie"];
  return [authType];
}

async function attemptEwsSend(
  dto: EmailDto,
  ewsUrl: string,
  username: string,
  password: string,
  authMode: string,
  version: ExchangeVersion,
  rejectUnauthorized: boolean,
  fromAddress: string,
): Promise<{ success: boolean; error?: string; is401?: boolean }> {
  try {
    const service = new ExchangeService(version);
    service.Url = new Uri(ewsUrl);

    if (authMode === "ntlm") {
      const xhrApi = new XhrApi();
      if (!rejectUnauthorized) {
        xhrApi.allowUntrustedCertificate = true;
      }
      xhrApi.useNtlmAuthentication(username, password);
      ConfigurationApi.ConfigureXHR(xhrApi);
    } else {
      if (!rejectUnauthorized) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
      }
      service.Credentials = new WebCredentials(username, password);
      ConfigurationApi.ConfigureXHR(new xhr2());
    }

    const message = new EmailMessage(service);
    message.Subject = dto.subject;
    message.Body = new MessageBody(
      dto.isHtml !== false ? BodyType.HTML : BodyType.Text,
      dto.body
    );
    message.ToRecipients.Add(dto.to);

    if (dto.cc) {
      dto.cc.split(",").map(e => e.trim()).filter(Boolean).forEach(e => message.CcRecipients.Add(e));
    }
    if (dto.bcc) {
      dto.bcc.split(",").map(e => e.trim()).filter(Boolean).forEach(e => message.BccRecipients.Add(e));
    }

    await message.SendAndSaveCopy();

    if (!rejectUnauthorized) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "1";
    }

    return { success: true };
  } catch (error: any) {
    if (!rejectUnauthorized) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "1";
    }

    const errMsg = error?.message || error?.toString?.() || "Unknown error";
    const is401 = errMsg.includes("401") || errMsg.includes("Unauthorized") || errMsg.includes("unauthorized");

    return { success: false, error: errMsg, is401 };
  }
}

async function sendViaEws(dto: EmailDto): Promise<SendEmailResult> {
  const config = getEwsConfig();
  if (!config) {
    return { success: false, error: "EWS not configured. Set EWS_URL, EWS_USERNAME, EWS_PASSWORD.", method: "ews" };
  }

  const usernameVariants = deriveUsernameVariants(config.ewsUser, config.ewsDomain, config.from);
  const authModes = getAuthModes(config.authType);

  console.log("[EWS] Attempting — URL:", config.ewsUrl);
  console.log("[EWS] Auth modes to try:", authModes.join(", "));
  console.log("[EWS] Username variants to try:", usernameVariants.map(u => u.includes("\\") ? u.split("\\")[0] + "\\***" : u.includes("@") ? "***@" + u.split("@")[1] : "***").join(", "));

  const attempts: string[] = [];
  let lastNon401Error: string | null = null;

  for (const authMode of authModes) {
    for (const username of usernameVariants) {
      const safeUsername = username.includes("\\")
        ? username.split("\\")[0] + "\\***"
        : username.includes("@")
          ? "***@" + username.split("@")[1]
          : "***";

      console.log(`[EWS] Trying auth=${authMode} user=${safeUsername}`);
      attempts.push(`${authMode}/${safeUsername}`);

      const result = await attemptEwsSend(
        dto,
        config.ewsUrl,
        username,
        config.ewsPass,
        authMode,
        config.version,
        config.rejectUnauthorized,
        config.from,
      );

      if (result.success) {
        console.log(`[EWS] Email sent successfully via ${authMode} as ${safeUsername}`);
        return {
          success: true,
          messageId: `ews-${Date.now()}`,
          method: "ews",
          details: `Sent via EWS (${authMode}, ${safeUsername})`,
        };
      }

      if (result.is401) {
        console.log(`[EWS] 401 — auth=${authMode} user=${safeUsername}, trying next...`);
        continue;
      }

      lastNon401Error = result.error || "Unknown error";
      console.error(`[EWS] Non-401 error (stopping): ${lastNon401Error}`);
      return {
        success: false,
        error: `EWS error — ${lastNon401Error}`,
        method: "ews",
        details: `Failed at ${authMode}/${safeUsername}. Attempted: ${attempts.join(", ")}`,
      };
    }
  }

  const errorMsg = `All EWS auth attempts failed with 401. Tried: ${attempts.join(", ")}`;
  console.error("[EWS]", errorMsg);
  return {
    success: false,
    error: errorMsg,
    method: "ews",
  };
}

export async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<SendEmailResult> {
  const smtpConfig = getSmtpConfig();
  if (smtpConfig) {
    console.log("[Email] Trying SMTP first...");
    const smtpResult = await sendViaSmtp({ to, subject, body });
    if (smtpResult.success) return smtpResult;
    console.log("[Email] SMTP failed, falling back to EWS...");
  } else {
    console.log("[Email] SMTP not configured, trying EWS directly...");
  }

  return sendViaEws({ to, subject, body });
}

export async function sendEmailSmtp(
  to: string,
  subject: string,
  body: string,
  options?: { cc?: string; bcc?: string; isHtml?: boolean }
): Promise<SendEmailResult> {
  return sendViaSmtp({ to, subject, body, ...options });
}

export async function sendEmailEws(
  to: string,
  subject: string,
  body: string,
  options?: { cc?: string; bcc?: string; isHtml?: boolean }
): Promise<SendEmailResult> {
  return sendViaEws({ to, subject, body, ...options });
}

export async function checkEmailHealth(): Promise<{
  smtp: { configured: boolean; connected?: boolean; error?: string };
  ews: { configured: boolean };
}> {
  const smtpConfig = getSmtpConfig();
  const ewsConfig = getEwsConfig();

  const result: any = {
    smtp: { configured: !!smtpConfig },
    ews: { configured: !!ewsConfig },
  };

  if (smtpConfig) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        auth: { user: smtpConfig.user, pass: smtpConfig.pass },
        tls: { rejectUnauthorized: smtpConfig.rejectUnauthorized },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
      });
      await transporter.verify();
      result.smtp.connected = true;
    } catch (error: any) {
      result.smtp.connected = false;
      result.smtp.error = error.message;
    }
  }

  return result;
}
