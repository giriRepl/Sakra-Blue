import EWS from "node-ews";

interface SendEmailResult {
  success: boolean;
  error?: string;
  messageId?: string;
}

export async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<SendEmailResult> {
  const ewsUrl = process.env.EWS_URL;
  const ewsUser = process.env.EWS_USERNAME;
  const ewsPass = process.env.EWS_PASSWORD;
  const ewsDomain = process.env.EWS_DOMAIN || "";

  if (!ewsUrl || !ewsUser || !ewsPass) {
    console.log("[EWS] Missing config — EWS_URL:", !!ewsUrl, "EWS_USERNAME:", !!ewsUser, "EWS_PASSWORD:", !!ewsPass);
    return { success: false, error: "EWS not configured. Set EWS_URL, EWS_USERNAME, EWS_PASSWORD." };
  }

  const ewsConfig: any = {
    username: ewsUser,
    password: ewsPass,
    host: ewsUrl,
    auth: "ntlm",
  };

  if (ewsDomain) {
    ewsConfig.domain = ewsDomain;
  }

  const options: any = {
    rejectUnauthorized: process.env.EWS_REJECT_UNAUTHORIZED !== "false",
  };

  console.log("[EWS] Connecting — URL:", ewsUrl, "Domain:", ewsDomain || "(none)", "Auth: ntlm");

  try {
    const ews = new EWS(ewsConfig, options);

    const ewsFunction = "CreateItem";
    const ewsArgs = {
      attributes: {
        MessageDisposition: "SendAndSaveCopy",
      },
      SavedItemFolderId: {
        DistinguishedFolderId: {
          attributes: { Id: "sentitems" },
        },
      },
      Items: {
        Message: {
          ItemClass: "IPM.Note",
          Subject: subject,
          Body: {
            attributes: { BodyType: "HTML" },
            $value: body,
          },
          ToRecipients: {
            Mailbox: {
              EmailAddress: to,
            },
          },
        },
      },
    };

    const result = await ews.run(ewsFunction, ewsArgs);
    console.log("[EWS] Email sent successfully to:", to);
    return { success: true, messageId: `ews-${Date.now()}` };
  } catch (error: any) {
    const errMsg = error?.message || error?.toString?.() || "Unknown error";
    console.error("[EWS] Send failed:", errMsg);
    if (error?.stack) console.error("[EWS] Stack:", error.stack);
    return {
      success: false,
      error: `EWS error (${ewsUrl}) — ${errMsg}`,
    };
  }
}
