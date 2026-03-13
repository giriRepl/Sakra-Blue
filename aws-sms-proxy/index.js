const http = require("http");
const https = require("https");
const querystring = require("querystring");

const PORT = process.env.PORT || 3000;
const KARIX_API_KEY = process.env.KARIX_API_KEY;
const KARIX_URL = "https://japi.instaalerts.zone/httpapi/QueryStringReceiver";

if (!KARIX_API_KEY) {
  console.error("KARIX_API_KEY environment variable is required");
  process.exit(1);
}

function sendToKarix(params) {
  return new Promise((resolve, reject) => {
    const qs = querystring.stringify(params);
    const fullUrl = `${KARIX_URL}?${qs}`;
    const url = new URL(fullUrl);

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: "GET",
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(body) });
        } catch {
          resolve({ statusCode: res.statusCode, body });
        }
      });
    });

    req.on("error", reject);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200);
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  if (req.method !== "POST" || req.url !== "/send-sms") {
    res.writeHead(404);
    res.end(JSON.stringify({ success: false, message: "Not found" }));
    return;
  }

  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", async () => {
    try {
      const { mobile, message, templateId, entityId, senderId } = JSON.parse(body);

      if (!mobile || !message || !senderId) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, message: "Missing required fields: mobile, message, senderId" }));
        return;
      }

      const params = {
        key: KARIX_API_KEY,
        msgtype: "TXT",
        senderid: senderId,
        dltentityid: entityId || "",
        dlttempid: templateId || "",
        destination: mobile,
        message: message,
      };

      console.log(`Sending SMS to ${mobile} via ${senderId}`);

      const result = await sendToKarix(params);

      if (result.statusCode === 200) {
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: "SMS sent successfully", karixResponse: result.body }));
      } else {
        res.writeHead(502);
        res.end(JSON.stringify({ success: false, message: "Karix API error", karixResponse: result.body }));
      }
    } catch (err) {
      console.error("Error:", err.message);
      res.writeHead(500);
      res.end(JSON.stringify({ success: false, message: err.message }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`SMS Proxy running on port ${PORT}`);
});
