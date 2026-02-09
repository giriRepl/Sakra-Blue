# Sakra SMS Proxy

Thin proxy layer that forwards SMS requests to the Karix API. Deploy this on AWS and whitelist the server's IP in Karix.

## Setup

1. Set the environment variable:
   ```
   KARIX_API_KEY=your_karix_api_key_here
   ```

2. Install and run:
   ```
   npm install
   npm start
   ```

   The server starts on port 3000 (or set `PORT` env variable).

## API

### POST /send-sms

Send an SMS through the Karix gateway.

**Request:**
```json
{
  "mobile": "919876543210",
  "message": "Your OTP for Sakra IKOC is 1234",
  "templateId": "1107171234567890123",
  "entityId": "1101587610000011042",
  "senderId": "SAKRAA"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "SMS sent successfully",
  "karixResponse": { ... }
}
```

**Error Response (4xx/5xx):**
```json
{
  "success": false,
  "message": "error description"
}
```

### GET /health

Health check endpoint. Returns `{ "status": "ok" }`.

## Deployment Notes

- No external dependencies needed (uses only Node.js built-in modules)
- Set `KARIX_API_KEY` as an environment variable (never hardcode it)
- Whitelist the AWS server's static IP in your Karix account
- Works with Node.js 18+
