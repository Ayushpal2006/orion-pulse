import {
  type InvoiceImagePagePlan,
  type NormalizedInvoiceData,
  INVOICE_CONTENT_PADDING,
  INVOICE_IMAGE_WIDTH,
  formatInrCurrency,
  planInvoiceImagePages,
  wrapTextForCanvas,
} from "./invoice-share-format";

export interface GeneratedInvoiceImage {
  filename: string;
  pageNumber: number;
  totalPages: number;
  width: number;
  height: number;
  blob: Blob;
  base64: string;
  dataUrl: string;
}

const APKA_BILL_NAVY = "#0B1E4D";
const APKA_BILL_BLUE = "#0B63CE";
const APKA_BILL_GREEN = "#16A34A";
const SLATE_900 = "#0F172A";
const SLATE_700 = "#334155";
const SLATE_600 = "#475569";
const SLATE_500 = "#64748B";
const SLATE_200 = "#E2E8F0";
const SLATE_100 = "#F1F5F9";
const SLATE_50 = "#F8FAFC";

const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

async function loadImageSafe(src?: string): Promise<HTMLImageElement | null> {
  if (!src || typeof Image === "undefined") return null;
  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;
    const finish = (result: HTMLImageElement | null) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const timer = setTimeout(() => finish(null), 2500);
    if (src.startsWith("http://") || src.startsWith("https://")) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => {
      clearTimeout(timer);
      finish(img.naturalWidth > 0 ? img : null);
    };
    img.onerror = () => {
      clearTimeout(timer);
      finish(null);
    };
    img.src = src;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawLogoBox(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  fallbackText: string,
  x: number,
  y: number,
  size: number,
) {
  ctx.save();
  drawRoundedRect(ctx, x, y, size, size, 14);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.strokeStyle = SLATE_200;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  if (img) {
    ctx.clip();
    const pad = 6;
    const inner = size - pad * 2;
    const ratio = Math.min(inner / img.naturalWidth, inner / img.naturalHeight);
    const drawW = img.naturalWidth * ratio;
    const drawH = img.naturalHeight * ratio;
    ctx.drawImage(
      img,
      x + pad + (inner - drawW) / 2,
      y + pad + (inner - drawH) / 2,
      drawW,
      drawH,
    );
  } else {
    ctx.fillStyle = APKA_BILL_NAVY;
    ctx.font = `800 22px ${FONT_STACK}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(fallbackText, x + size / 2, y + size / 2);
  }
  ctx.restore();
}

function drawStatusPill(
  ctx: CanvasRenderingContext2D,
  label: NormalizedInvoiceData["paymentStatusLabel"],
  rightX: number,
  y: number,
) {
  const palette: Record<
    NormalizedInvoiceData["paymentStatusLabel"],
    { bg: string; border: string; text: string }
  > = {
    PAID: { bg: "#ECFDF5", border: "#A7F3D0", text: "#047857" },
    "PARTIAL DUE": { bg: "#FFFBEB", border: "#FDE68A", text: "#B45309" },
    UNPAID: { bg: "#FEF2F2", border: "#FECACA", text: "#B91C1C" },
    VOID: { bg: "#FEF2F2", border: "#FCA5A5", text: "#991B1B" },
  };
  const colors = palette[label];

  ctx.save();
  ctx.font = `800 12px ${FONT_STACK}`;
  const textW = ctx.measureText(label).width;
  const pillW = textW + 22;
  const pillH = 26;
  const pillX = rightX - pillW;

  drawRoundedRect(ctx, pillX, y, pillW, pillH, 999);
  ctx.fillStyle = colors.bg;
  ctx.fill();
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.fillStyle = colors.text;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, pillX + pillW / 2, y + pillH / 2 + 0.5);
  ctx.restore();
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Canvas image encoding returned an empty PNG."));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

function sanitizeFilenamePart(value: string): string {
  const cleaned = String(value || "invoice")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "invoice";
}

function drawPage(
  ctx: CanvasRenderingContext2D,
  invoice: NormalizedInvoiceData,
  plan: InvoiceImagePagePlan,
  officialLogo: HTMLImageElement | null,
  customShopLogo: HTMLImageElement | null,
) {
  const W = plan.width;
  const H = plan.height;
  const pad = INVOICE_CONTENT_PADDING;
  const innerW = W - pad * 2;
  const accentColor = invoice.brandColor || APKA_BILL_NAVY;

  // 1. Crisp white canvas background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);

  // 2. Top Apka Bill signature gradient accent stripe
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, APKA_BILL_NAVY);
  grad.addColorStop(0.6, accentColor !== APKA_BILL_NAVY ? accentColor : APKA_BILL_BLUE);
  grad.addColorStop(1, APKA_BILL_GREEN);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, 10);

  let y = 32;

  // 3. Header Section
  if (plan.isFirstPage) {
    const primaryLogo = customShopLogo || officialLogo;
    drawLogoBox(
      ctx,
      primaryLogo,
      invoice.shopName.slice(0, 2).toUpperCase() || "AB",
      pad,
      y,
      78,
    );

    // Right side: TAX INVOICE badge + Invoice # + Date
    const rightX = W - pad;
    const isTaxInvoice = Boolean(invoice.shopGstin || invoice.gst > 0);
    const titleLabel = isTaxInvoice ? "TAX INVOICE" : "INVOICE";

    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillStyle = APKA_BILL_BLUE;
    ctx.font = `800 13px ${FONT_STACK}`;
    ctx.fillText(titleLabel, rightX, y + 2);

    ctx.fillStyle = SLATE_900;
    ctx.font = `800 22px ${FONT_STACK}`;
    ctx.fillText(invoice.invoiceNumber, rightX, y + 24);

    if (invoice.dateTimeLabel) {
      ctx.fillStyle = SLATE_600;
      ctx.font = `500 14px ${FONT_STACK}`;
      ctx.fillText(invoice.dateTimeLabel, rightX, y + 54);
    }

    if (plan.totalPages > 1) {
      ctx.fillStyle = SLATE_500;
      ctx.font = `600 13px ${FONT_STACK}`;
      ctx.fillText(`Page ${plan.pageNumber} of ${plan.totalPages}`, rightX, y + 78);
    }

    // Left/middle: Shop Name + Address + Phone/Email + GSTIN
    const shopTextX = pad + 96;
    let shopY = y;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = `800 24px ${FONT_STACK}`;
    const shopNameLines = wrapTextForCanvas(invoice.shopName, 380, (t) => ctx.measureText(t).width);
    ctx.fillStyle = SLATE_900;
    for (const line of shopNameLines) {
      ctx.fillText(line, shopTextX, shopY);
      shopY += 30;
    }

    if (invoice.shopAddress) {
      ctx.font = `500 14px ${FONT_STACK}`;
      ctx.fillStyle = SLATE_600;
      const addrLines = wrapTextForCanvas(invoice.shopAddress, 380, (t) => ctx.measureText(t).width);
      for (const line of addrLines) {
        ctx.fillText(line, shopTextX, shopY + 2);
        shopY += 22;
      }
    }

    const contactLine = [
      invoice.shopPhone ? `Ph: ${invoice.shopPhone}` : "",
      invoice.shopEmail || "",
    ]
      .filter(Boolean)
      .join("  •  ");
    if (contactLine) {
      ctx.font = `500 14px ${FONT_STACK}`;
      ctx.fillStyle = SLATE_600;
      ctx.fillText(contactLine, shopTextX, shopY + 4);
      shopY += 24;
    }

    if (invoice.shopGstin) {
      ctx.font = `700 13px ${FONT_STACK}`;
      ctx.fillStyle = SLATE_700;
      ctx.fillText(`GSTIN: ${invoice.shopGstin}`, shopTextX, shopY + 4);
    }

    y = 10 + plan.headerHeight - 10;

    // Customer & Payment Info Card
    const cardH = plan.customerCardHeight - 16;
    drawRoundedRect(ctx, pad, y, innerW, cardH, 14);
    ctx.fillStyle = SLATE_50;
    ctx.fill();
    ctx.strokeStyle = SLATE_200;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = SLATE_500;
    ctx.font = `700 11px ${FONT_STACK}`;
    ctx.fillText("BILLED TO", pad + 20, y + 16);

    ctx.fillStyle = SLATE_900;
    ctx.font = `700 18px ${FONT_STACK}`;
    ctx.fillText(invoice.customerName, pad + 20, y + 34);

    if (invoice.customerPhone) {
      ctx.fillStyle = SLATE_600;
      ctx.font = `600 14px ${FONT_STACK}`;
      ctx.fillText(`Mobile: ${invoice.customerPhone}`, pad + 20, y + 60);
    }
    if (invoice.customerAddress) {
      ctx.fillStyle = SLATE_500;
      ctx.font = `500 13px ${FONT_STACK}`;
      ctx.fillText(invoice.customerAddress, pad + 20, y + (invoice.customerPhone ? 80 : 60));
    }

    // Payment column on right inside card
    ctx.textAlign = "right";
    ctx.fillStyle = SLATE_500;
    ctx.font = `700 11px ${FONT_STACK}`;
    ctx.fillText("PAYMENT", rightX - 20, y + 16);

    ctx.fillStyle = SLATE_900;
    ctx.font = `700 16px ${FONT_STACK}`;
    ctx.fillText(invoice.paymentMethod, rightX - 20, y + 34);

    drawStatusPill(ctx, invoice.paymentStatusLabel, rightX - 20, y + 58);

    y += cardH + 20;
  } else {
    // Compact header on continuation pages
    drawLogoBox(
      ctx,
      officialLogo || customShopLogo,
      invoice.shopName.slice(0, 2).toUpperCase() || "AB",
      pad,
      y,
      54,
    );
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = SLATE_900;
    ctx.font = `800 20px ${FONT_STACK}`;
    ctx.fillText(invoice.shopName, pad + 70, y + 4);

    ctx.fillStyle = SLATE_600;
    ctx.font = `600 14px ${FONT_STACK}`;
    ctx.fillText(
      `Invoice: ${invoice.invoiceNumber}${invoice.dateTimeLabel ? `  •  ${invoice.dateTimeLabel}` : ""}`,
      pad + 70,
      y + 30,
    );

    ctx.textAlign = "right";
    ctx.fillStyle = APKA_BILL_BLUE;
    ctx.font = `800 14px ${FONT_STACK}`;
    ctx.fillText(`Page ${plan.pageNumber} of ${plan.totalPages}`, W - pad, y + 16);

    y = 10 + plan.headerHeight;
  }

  // 4. Itemized Table Header
  drawRoundedRect(ctx, pad, y, innerW, plan.tableHeaderHeight, 10);
  ctx.fillStyle = APKA_BILL_NAVY;
  ctx.fill();

  ctx.textBaseline = "middle";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `700 13px ${FONT_STACK}`;
  const headerMidY = y + plan.tableHeaderHeight / 2;

  ctx.textAlign = "left";
  ctx.fillText("#", pad + 16, headerMidY);
  ctx.fillText("ITEM", pad + 56, headerMidY);

  ctx.textAlign = "right";
  ctx.fillText("QTY", pad + 492, headerMidY);
  ctx.fillText("RATE", pad + 642, headerMidY);
  ctx.fillText("AMOUNT", pad + innerW - 16, headerMidY);

  y += plan.tableHeaderHeight;

  // 5. Item Rows
  for (let i = 0; i < plan.rows.length; i++) {
    const row = plan.rows[i];
    if (i % 2 === 1) {
      ctx.fillStyle = SLATE_50;
      ctx.fillRect(pad, y, innerW, row.rowHeight);
    }

    const topTextY = y + 16;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillStyle = SLATE_500;
    ctx.font = `600 14px ${FONT_STACK}`;
    ctx.fillText(String(row.item.index), pad + 16, topTextY);

    ctx.fillStyle = SLATE_900;
    ctx.font = `600 16px ${FONT_STACK}`;
    let lineY = topTextY;
    for (const line of row.nameLines) {
      ctx.fillText(line, pad + 56, lineY);
      lineY += 25;
    }
    if (row.item.discount > 0) {
      ctx.fillStyle = APKA_BILL_GREEN;
      ctx.font = `600 12px ${FONT_STACK}`;
      ctx.fillText(`Item discount: ${formatInrCurrency(row.item.discount)}`, pad + 56, lineY);
    }

    ctx.textAlign = "right";
    ctx.fillStyle = SLATE_700;
    ctx.font = `600 15px ${FONT_STACK}`;
    ctx.fillText(String(row.item.qty), pad + 492, topTextY);
    ctx.fillText(formatInrCurrency(row.item.rate), pad + 642, topTextY);

    ctx.fillStyle = SLATE_900;
    ctx.font = `700 16px ${FONT_STACK}`;
    ctx.fillText(formatInrCurrency(row.item.lineTotal), pad + innerW - 16, topTextY);

    // Subtle divider line below row
    ctx.strokeStyle = SLATE_100;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, y + row.rowHeight);
    ctx.lineTo(pad + innerW, y + row.rowHeight);
    ctx.stroke();

    y += row.rowHeight;
  }

  // 6. Totals Summary (on Final Page)
  if (plan.isLastPage) {
    y += 18;
    const summaryBoxW = 390;
    const summaryBoxX = pad + innerW - summaryBoxW;
    const summaryInnerH = plan.summaryHeight - 28;

    drawRoundedRect(ctx, summaryBoxX, y, summaryBoxW, summaryInnerH, 14);
    ctx.fillStyle = SLATE_50;
    ctx.fill();
    ctx.strokeStyle = SLATE_200;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    let sy = y + 20;
    const labelX = summaryBoxX + 20;
    const valX = summaryBoxX + summaryBoxW - 20;

    const drawSummaryRow = (
      label: string,
      value: string,
      opts?: { color?: string; bold?: boolean; size?: number },
    ) => {
      ctx.textBaseline = "middle";
      ctx.font = `${opts?.bold ? 700 : 500} ${opts?.size || 15}px ${FONT_STACK}`;
      ctx.fillStyle = opts?.color || SLATE_600;
      ctx.textAlign = "left";
      ctx.fillText(label, labelX, sy + 12);

      ctx.fillStyle = opts?.color || SLATE_900;
      ctx.font = `${opts?.bold ? 800 : 600} ${opts?.size || 15}px ${FONT_STACK}`;
      ctx.textAlign = "right";
      ctx.fillText(value, valX, sy + 12);
      sy += 34;
    };

    drawSummaryRow("Subtotal", formatInrCurrency(invoice.subtotal));
    if (invoice.discount > 0) {
      drawSummaryRow("Discount", `- ${formatInrCurrency(invoice.discount)}`, {
        color: APKA_BILL_GREEN,
        bold: true,
      });
    }
    drawSummaryRow("Tax (GST)", formatInrCurrency(invoice.gst));

    // Divider before Grand Total
    ctx.strokeStyle = SLATE_200;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(labelX, sy - 4);
    ctx.lineTo(valX, sy - 4);
    ctx.stroke();
    sy += 8;

    drawSummaryRow("Grand Total", formatInrCurrency(invoice.grandTotal), {
      color: SLATE_900,
      bold: true,
      size: 20,
    });
    drawSummaryRow("Paid Amount", formatInrCurrency(invoice.paidAmount), {
      color: APKA_BILL_GREEN,
      bold: true,
    });
    drawSummaryRow("Remaining Balance", formatInrCurrency(invoice.balance), {
      color: invoice.balance > 0 ? "#B91C1C" : SLATE_600,
      bold: invoice.balance > 0,
    });

    y += summaryInnerH + 22;

    // 7. Footer: Thank-you message + contact + official Apka Bill branding badge
    ctx.strokeStyle = SLATE_200;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(pad + innerW, y);
    ctx.stroke();

    y += 18;
    ctx.textBaseline = "top";
    ctx.textAlign = "center";
    ctx.fillStyle = SLATE_900;
    ctx.font = `700 16px ${FONT_STACK}`;
    const thankLines = wrapTextForCanvas(invoice.thankYouMessage, innerW - 40, (t) =>
      ctx.measureText(t).width,
    );
    for (const line of thankLines) {
      ctx.fillText(line, W / 2, y);
      y += 24;
    }

    const footerContact = [invoice.shopPhone, invoice.shopEmail].filter(Boolean).join("  •  ");
    if (footerContact) {
      ctx.fillStyle = SLATE_600;
      ctx.font = `500 13px ${FONT_STACK}`;
      ctx.fillText(footerContact, W / 2, y + 2);
      y += 22;
    }

    // Official Apka Bill powered badge centered at bottom
    const badgeY = Math.max(y + 8, H - 46);
    ctx.fillStyle = SLATE_500;
    ctx.font = `600 12px ${FONT_STACK}`;
    if (officialLogo) {
      const text = "Powered by Apka Bill";
      const textW = ctx.measureText(text).width;
      const totalBadgeW = 20 + 6 + textW;
      const startX = W / 2 - totalBadgeW / 2;
      ctx.drawImage(officialLogo, startX, badgeY - 2, 20, 20);
      ctx.textAlign = "left";
      ctx.fillText(text, startX + 26, badgeY + 1);
    } else {
      ctx.textAlign = "center";
      ctx.fillText("Powered by Apka Bill", W / 2, badgeY + 1);
    }
  } else {
    // Intermediate page footer
    y += 20;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = APKA_BILL_BLUE;
    ctx.font = `700 14px ${FONT_STACK}`;
    ctx.fillText(
      `Continued on Page ${plan.pageNumber + 1} of ${plan.totalPages} — All items preserved`,
      W / 2,
      y,
    );
  }
}

/**
 * Generates crisp branded white-background Apka Bill PNG invoice image(s) locally
 * using HTML5 Canvas without external network/image upload dependencies.
 */
export async function generateInvoiceImages(
  invoice: NormalizedInvoiceData,
): Promise<GeneratedInvoiceImage[]> {
  if (typeof document === "undefined") {
    throw new Error("Invoice image generation requires a browser or WebView context.");
  }

  const measureCanvas = document.createElement("canvas");
  const measureCtx = measureCanvas.getContext("2d");
  if (!measureCtx) {
    throw new Error("Unable to initialize 2D canvas context for invoice generation.");
  }

  const plans = planInvoiceImagePages(
    invoice,
    (segment) => {
      measureCtx.font = `600 16px ${FONT_STACK}`;
      return measureCtx.measureText(segment).width;
    },
    (segment) => {
      measureCtx.font = `500 14px ${FONT_STACK}`;
      return measureCtx.measureText(segment).width;
    },
  );

  const [officialLogo, customShopLogo] = await Promise.all([
    loadImageSafe("/logo.png"),
    invoice.shopLogo ? loadImageSafe(invoice.shopLogo) : Promise.resolve(null),
  ]);

  const baseName = sanitizeFilenamePart(invoice.invoiceNumber);
  const results: GeneratedInvoiceImage[] = [];

  for (const plan of plans) {
    const canvas = document.createElement("canvas");
    canvas.width = INVOICE_IMAGE_WIDTH;
    canvas.height = plan.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to render invoice image page.");
    }

    drawPage(ctx, invoice, plan, officialLogo, customShopLogo);

    const dataUrl = canvas.toDataURL("image/png");
    const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
    const blob = await canvasToPngBlob(canvas);
    const filename =
      plan.totalPages === 1
        ? `${baseName}.png`
        : `${baseName}-page-${plan.pageNumber}-of-${plan.totalPages}.png`;

    results.push({
      filename,
      pageNumber: plan.pageNumber,
      totalPages: plan.totalPages,
      width: plan.width,
      height: plan.height,
      blob,
      base64,
      dataUrl,
    });
  }

  return results;
}

