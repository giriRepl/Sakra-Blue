import httpntlm from "httpntlm";

interface SendEmailResult {
  success: boolean;
  error?: string;
  messageId?: string;
}

function buildSoapEnvelope(to: string, subject: string, body: string, from: string): string {
  const escapedSubject = subject.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const escapedBody = body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types"
               xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages">
  <soap:Header>
    <t:RequestServerVersion Version="Exchange2013"/>
  </soap:Header>
  <soap:Body>
    <m:CreateItem MessageDisposition="SendAndSaveCopy">
      <m:SavedItemFolderId>
        <t:DistinguishedFolderId Id="sentitems"/>
      </m:SavedItemFolderId>
      <m:Items>
        <t:Message>
          <t:Subject>${escapedSubject}</t:Subject>
          <t:Body BodyType="HTML">${escapedBody}</t:Body>
          <t:ToRecipients>
            <t:Mailbox>
              <t:EmailAddress>${to}</t:EmailAddress>
            </t:Mailbox>
          </t:ToRecipients>
          <t:From>
            <t:Mailbox>
              <t:EmailAddress>${from}</t:EmailAddress>
            </t:Mailbox>
          </t:From>
        </t:Message>
      </m:Items>
    </m:CreateItem>
  </soap:Body>
</soap:Envelope>`;
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
  const fromAddress = process.env.SMTP_FROM || ewsUser || "";

  if (!ewsUrl || !ewsUser || !ewsPass) {
    console.log("[EWS] Missing config — EWS_URL:", !!ewsUrl, "EWS_USERNAME:", !!ewsUser, "EWS_PASSWORD:", !!ewsPass);
    return { success: false, error: "EWS not configured. Set EWS_URL, EWS_USERNAME, EWS_PASSWORD." };
  }

  const soapBody = buildSoapEnvelope(to, subject, body, fromAddress);

  console.log("[EWS] Sending via NTLM — URL:", ewsUrl, "Domain:", ewsDomain || "(none)", "To:", to);

  return new Promise((resolve) => {
    const ntlmOptions: any = {
      url: ewsUrl,
      username: ewsUser,
      password: ewsPass,
      body: soapBody,
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
      },
    };

    if (ewsDomain) {
      ntlmOptions.domain = ewsDomain;
    }

    httpntlm.post(ntlmOptions, (err: any, res: any) => {
      if (err) {
        console.error("[EWS] NTLM request error:", err.message || err);
        resolve({
          success: false,
          error: `EWS error (${ewsUrl}) — ${err.message || "Connection failed"}`,
        });
        return;
      }

      console.log("[EWS] Response status:", res.statusCode);

      if (res.statusCode === 200) {
        const responseBody = res.body || "";
        if (responseBody.includes("NoError") || responseBody.includes("ResponseClass=\"Success\"")) {
          console.log("[EWS] Email sent successfully to:", to);
          resolve({ success: true, messageId: `ews-${Date.now()}` });
        } else if (responseBody.includes("ErrorMessage") || responseBody.includes("ResponseClass=\"Error\"")) {
          const errorMatch = responseBody.match(/<m:MessageText>(.*?)<\/m:MessageText>/);
          const errMsg = errorMatch ? errorMatch[1] : "Exchange returned an error";
          console.error("[EWS] Exchange error:", errMsg);
          resolve({ success: false, error: `EWS error — ${errMsg}` });
        } else {
          console.log("[EWS] Email likely sent (status 200)");
          resolve({ success: true, messageId: `ews-${Date.now()}` });
        }
      } else if (res.statusCode === 401) {
        console.error("[EWS] Authentication failed (401)");
        resolve({ success: false, error: `EWS error (${ewsUrl}) — 401 Unauthorized` });
      } else {
        console.error("[EWS] HTTP error:", res.statusCode, res.body?.substring(0, 500));
        resolve({
          success: false,
          error: `EWS error (${ewsUrl}) — HTTP ${res.statusCode}`,
        });
      }
    });
  });
}
