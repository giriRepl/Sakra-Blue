import PDFDocument from "pdfkit";
import { format } from "date-fns";

interface InvoicePdfData {
  invoiceNumber: string;
  customerName: string;
  packageName: string;
  totalAmount: number;
  purchaseDate: Date;
}

function formatCurrency(amount: number): string {
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `INR ${formatted}`;
}

export function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const formattedDate = format(data.purchaseDate, "dd MMM yyyy");
    const pageWidth = doc.page.width - 100;

    doc.rect(0, 0, doc.page.width, 100).fill("#9d174d");
    doc.fontSize(22).fillColor("#ffffff").font("Helvetica-Bold")
      .text("Takshasila Hospitals Operating Private Limited", 50, 30, { width: pageWidth, align: "center" });
    doc.fontSize(11).fillColor("#fce7f3").font("Helvetica")
      .text("Healthcare Package Invoice", 50, 58, { width: pageWidth, align: "center" });

    doc.fillColor("#374151");
    const infoY = 130;

    doc.fontSize(10).fillColor("#6b7280").font("Helvetica")
      .text("Invoice Number", 50, infoY);
    doc.fontSize(13).fillColor("#111827").font("Helvetica-Bold")
      .text(data.invoiceNumber, 50, infoY + 16);

    doc.fontSize(10).fillColor("#6b7280").font("Helvetica")
      .text("Date of Purchase", 350, infoY, { width: pageWidth - 300, align: "right" });
    doc.fontSize(13).fillColor("#111827").font("Helvetica-Bold")
      .text(formattedDate, 350, infoY + 16, { width: pageWidth - 300, align: "right" });

    const tableTop = 195;
    const tableLeft = 50;
    const tableRight = 50 + pageWidth;
    const colMid = tableRight - 180;

    doc.rect(tableLeft, tableTop, pageWidth, 48).fill("#f9fafb");
    doc.rect(tableLeft, tableTop, pageWidth, 48).stroke("#e5e7eb");

    doc.fontSize(10).fillColor("#6b7280").font("Helvetica")
      .text("Billed To", tableLeft + 16, tableTop + 10);
    doc.fontSize(13).fillColor("#111827").font("Helvetica-Bold")
      .text(data.customerName, tableLeft + 16, tableTop + 26);

    const row1Y = tableTop + 48;
    doc.rect(tableLeft, row1Y, pageWidth, 40).stroke("#e5e7eb");
    doc.fontSize(10).fillColor("#6b7280").font("Helvetica")
      .text("Package", tableLeft + 16, row1Y + 13);
    doc.fontSize(12).fillColor("#111827").font("Helvetica-Bold")
      .text(data.packageName, colMid, row1Y + 12, { width: tableRight - colMid - 16, align: "right" });

    const row2Y = row1Y + 40;
    doc.rect(tableLeft, row2Y, pageWidth, 44).fill("#f0fdf4");
    doc.rect(tableLeft, row2Y, pageWidth, 44).stroke("#e5e7eb");
    doc.fontSize(12).fillColor("#111827").font("Helvetica-Bold")
      .text("Amount Paid", tableLeft + 16, row2Y + 14);
    doc.fontSize(15).fillColor("#15803d").font("Helvetica-Bold")
      .text(formatCurrency(data.totalAmount), colMid, row2Y + 13, { width: tableRight - colMid - 16, align: "right" });

    const thankY = row2Y + 74;
    doc.fontSize(11).fillColor("#6b7280").font("Helvetica")
      .text("Thank you for choosing Sakra IKOC for your healthcare needs.", 50, thankY, { width: pageWidth, align: "center" });

    doc.moveTo(50, thankY + 36).lineTo(tableRight, thankY + 36).stroke("#e5e7eb");

    const footerY = thankY + 52;
    doc.fontSize(10).fillColor("#374151").font("Helvetica-Bold")
      .text("Takshasila Hospitals Operating Private Limited", 50, footerY, { width: pageWidth, align: "center" });
    doc.fontSize(9).fillColor("#9ca3af").font("Helvetica")
      .text("Sy No 52/2 and 52/3, Sakra World Hospital, Outer Ring Road,", 50, footerY + 16, { width: pageWidth, align: "center" })
      .text("Marathahalli, Devarabeesanahalli, Varthur Hobli, Bengaluru Urban, Karnataka, 560103", 50, footerY + 28, { width: pageWidth, align: "center" });

    doc.end();
  });
}
