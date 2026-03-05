import { format } from "date-fns";

interface InvoiceData {
  invoiceNumber: string;
  customerName: string;
  packageName: string;
  totalAmount: number;
  purchaseDate: Date;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function generateInvoiceNumber(purchaseDate: Date): string {
  const dateStr = format(purchaseDate, "yyyyMMdd");
  const random = Math.floor(1000 + Math.random() * 9000);
  return `SIKOC-${dateStr}-${random}`;
}

export function buildInvoiceEmailHtml(data: InvoiceData): string {
  const formattedDate = format(data.purchaseDate, "dd MMM yyyy");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

          <tr>
            <td style="background-color:#9d174d;padding:28px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px;">Sakra IKOC Limited</h1>
              <p style="margin:6px 0 0;color:#fce7f3;font-size:13px;">Healthcare Package Invoice</p>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 32px 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0;font-size:13px;color:#6b7280;">Invoice Number</p>
                    <p style="margin:2px 0 0;font-size:15px;font-weight:600;color:#111827;">${data.invoiceNumber}</p>
                  </td>
                  <td align="right">
                    <p style="margin:0;font-size:13px;color:#6b7280;">Date of Purchase</p>
                    <p style="margin:2px 0 0;font-size:15px;font-weight:600;color:#111827;">${formattedDate}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 32px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
                <tr>
                  <td colspan="2" style="background-color:#f9fafb;padding:12px 16px;border-bottom:1px solid #e5e7eb;">
                    <p style="margin:0;font-size:13px;color:#6b7280;">Billed To</p>
                    <p style="margin:4px 0 0;font-size:15px;font-weight:600;color:#111827;">${data.customerName}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">
                    <p style="margin:0;font-size:13px;color:#6b7280;">Package</p>
                  </td>
                  <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:right;">
                    <p style="margin:0;font-size:14px;font-weight:600;color:#111827;">${data.packageName}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 16px;background-color:#f0fdf4;">
                    <p style="margin:0;font-size:14px;font-weight:700;color:#111827;">Amount Paid</p>
                  </td>
                  <td style="padding:14px 16px;background-color:#f0fdf4;text-align:right;">
                    <p style="margin:0;font-size:16px;font-weight:700;color:#15803d;">${formatCurrency(data.totalAmount)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px 0;text-align:center;">
              <p style="margin:0;font-size:13px;color:#6b7280;">Thank you for choosing Sakra IKOC for your healthcare needs.</p>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e7eb;padding-top:16px;">
                <tr>
                  <td align="center">
                    <p style="margin:0;font-size:12px;font-weight:600;color:#374151;">Sakra IKOC Limited</p>
                    <p style="margin:4px 0 0;font-size:11px;color:#9ca3af;line-height:1.5;">L 166, 5th Main, 3rd Floor, Service Road,<br>Sector 6, HSR Layout, Bengaluru, Karnataka 560102</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildInvoiceEmailSubject(invoiceNumber: string): string {
  return `Your Sakra IKOC Invoice - ${invoiceNumber}`;
}
