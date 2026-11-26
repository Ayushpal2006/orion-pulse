export interface StoreBrandingOverride {
  shopName?: string;
  address?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  logo?: string;
  thankYouMessage?: string;
  receiptFooter?: string;
  primaryColor?: string;
}

export interface NormalizedInvoiceItem {
  index: number;
  name: string;
  qty: number;
  rate: number;
  discount: number;
  lineTotal: number;
}

export interface NormalizedInvoiceData {
  invoiceNumber: string;
  dateTimeLabel: string;
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  shopEmail: string;
  shopGstin: string;
  shopLogo?: string;
  brandColor: string;
  thankYouMessage: string;
  hasNamedCustomer: boolean;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  paymentMethod: string;
  status: string;
  items: NormalizedInvoiceItem[];
  subtotal: number;
  discount: number;
  gst: number;
  grandTotal: number;
  paidAmount: number;
  balance: number;
  paymentStatusLabel: "PAID" | "PARTIAL DUE" | "UNPAID" | "VOID";
}

export interface PlannedInvoiceRow {
  item: NormalizedInvoiceItem;
  nameLines: string[];
  rowHeight: number;
}

export interface InvoiceImagePagePlan {
  pageNumber: number;
  totalPages: number;
  width: number;
  height: number;
  isFirstPage: boolean;
  isLastPage: boolean;
  rows: PlannedInvoiceRow[];
  headerHeight: number;
  customerCardHeight: number;
  tableHeaderHeight: number;
  tableRowsHeight: number;
  summaryHeight: number;
  footerHeight: number;
}

export const INVOICE_IMAGE_WIDTH = 900;
export const INVOICE_CONTENT_PADDING = 44;
export const INVOICE_MAX_PAGE_HEIGHT = 2500;

function roundCurrency(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  const rounded = Math.round(num * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/**
 * Formats an amount in INR with standard Indian digit grouping (e.g., ₹1,200.00).
 */
export function formatInrCurrency(value: unknown): string {
  const safe = roundCurrency(value);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
}

/**
 * Normalizes Indian / international phone numbers for optional wa.me deep-linking.
 * Returns null when phone is blank, all zeros, or fewer than 10 digits.
 */
export function normalizeWhatsAppPhoneNumber(rawPhone?: string | null): string | null {
  if (!rawPhone) return null;
  let digits = String(rawPhone).replace(/\D/g, "");
  // Placeholder numbers made of one repeated digit (walk-in 0000000000 / 9999999999) are never a recipient.
  const national = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  if (!digits || digits.length < 10 || /^(\d)\1+$/.test(national)) {
    return null;
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits;
  }
  if (digits.length === 10) {
    return `91${digits}`;
  }
  if (digits.length >= 11 && digits.length <= 15) {
    return digits;
  }
  return null;
}

function sanitizeHexColor(candidate?: string | null): string {
  const raw = String(candidate || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) {
    return raw;
  }
  return "#0B1E4D";
}

function sanitizeDisplayPhone(rawPhone?: string | null): string {
  const raw = String(rawPhone || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits || /^0+$/.test(digits) || digits.length < 7) {
    return "";
  }
  return raw;
}

function sanitizeImageLogoSource(rawLogo?: string | null): string | undefined {
  const val = String(rawLogo || "").trim();
  if (!val || val === "/logo.png") return undefined;
  if (
    val.startsWith("data:image/") ||
    val.startsWith("https://") ||
    val.startsWith("http://") ||
    val.startsWith("/")
  ) {
    return val;
  }
  return undefined;
}

function stripUrlsFromFooterText(text: string): string {
  const trimmed = String(text || "").trim();
  if (!trimmed) return "";
  // Do not accidentally leak localhost URLs through custom footer copy
  if (/https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(trimmed)) {
    return "";
  }
  return trimmed;
}

/**
 * Normalizes any ReceiptDTO, SlipDialog receipt, or offline queue receipt into
 * a uniform structure used by both the WhatsApp text formatter and invoice PNG renderer.
 */
export function normalizeInvoiceForShare(
  receipt: any,
  brandingOverride?: StoreBrandingOverride,
): NormalizedInvoiceData {
  if (!receipt || typeof receipt !== "object") {
    throw new Error("Invoice details are unavailable for sharing.");
  }

  const rawShop = receipt.branding || receipt.shop || {};
  const shopName =
    String(rawShop.shopName || rawShop.name || brandingOverride?.shopName || "").trim() ||
    "Apka Bill Store";
  const shopAddress = String(rawShop.address ?? brandingOverride?.address ?? "").trim();
  const shopPhone = String(rawShop.phone ?? brandingOverride?.phone ?? "").trim();
  const shopEmail = String(rawShop.email ?? brandingOverride?.email ?? "").trim();
  const shopGstin = String(rawShop.gstin ?? brandingOverride?.gstin ?? "").trim();
  const shopLogo = sanitizeImageLogoSource(rawShop.logo || brandingOverride?.logo);
  const brandColor = sanitizeHexColor(rawShop.primaryColor || brandingOverride?.primaryColor);

  const rawThankYou =
    receipt.thankYouMessage ||
    receipt.branding?.receiptFooter ||
    brandingOverride?.thankYouMessage ||
    brandingOverride?.receiptFooter ||
    "";
  const cleanThankYou = stripUrlsFromFooterText(rawThankYou) || "Thank you for choosing us!";

  const invoiceNumber =
    String(receipt.invoiceNumber || receipt.invoice || receipt.invoice_number || "").trim() ||
    "INV";
  const datePart = String(receipt.date || "").trim();
  const timePart = String(receipt.time || "").trim();
  const dateTimeLabel = [datePart, timePart].filter(Boolean).join(", ");

  const rawCustomerName = String(
    receipt.customer?.name ?? receipt.customerName ?? receipt.customer_name ?? "",
  ).trim();
  const hasNamedCustomer =
    rawCustomerName.length > 0 && rawCustomerName.toLowerCase() !== "walk-in customer";
  const customerName = hasNamedCustomer ? rawCustomerName : "Walk-in Customer";
  const customerPhone = sanitizeDisplayPhone(
    receipt.customer?.phone ?? receipt.customerPhone ?? receipt.customer_phone ?? "",
  );
  const customerAddress = String(receipt.customer?.address || "").trim();

  const rawItems = Array.isArray(receipt.items) ? receipt.items : [];
  if (rawItems.length === 0) {
    throw new Error("Cannot generate invoice image without line items.");
  }

  const items: NormalizedInvoiceItem[] = rawItems.map((item: any, idx: number) => {
    const qty = Number(item.qty ?? item.quantity ?? 1) || 1;
    const rate = roundCurrency(item.price ?? item.unitPrice ?? item.unit_price ?? item.sellingPrice ?? 0);
    const discount = roundCurrency(item.discount ?? 0);
    const explicitTotal = item.lineTotal ?? item.total ?? item.subtotal;
    const lineTotal =
      explicitTotal !== undefined && explicitTotal !== null
        ? roundCurrency(explicitTotal)
        : roundCurrency(qty * rate);
    const name = String(item.name || item.productName || `Item ${idx + 1}`).trim() || `Item ${idx + 1}`;
    return {
      index: idx + 1,
      name,
      qty,
      rate,
      discount,
      lineTotal,
    };
  });

  const computedItemsSubtotal = roundCurrency(
    items.reduce((sum, item) => sum + item.qty * item.rate, 0),
  );
  const subtotal = roundCurrency(
    receipt.subtotal !== undefined && receipt.subtotal !== null
      ? receipt.subtotal
      : computedItemsSubtotal,
  );
  const discount = Math.max(0, roundCurrency(receipt.discount ?? 0));
  const gst = Math.max(0, roundCurrency(receipt.gst ?? receipt.tax ?? 0));
  const grandTotal = Math.max(
    0,
    roundCurrency(
      receipt.grandTotal ?? receipt.total ?? receipt.total_amount ?? subtotal - discount + gst,
    ),
  );

  const rawPaid = receipt.paidAmount ?? receipt.amountPaid ?? receipt.amount_paid;
  const rawBalance = receipt.balance;

  let balance: number;
  if (rawBalance !== undefined && rawBalance !== null && rawBalance !== "") {
    balance = Math.max(0, roundCurrency(rawBalance));
  } else if (rawPaid !== undefined && rawPaid !== null && rawPaid !== "") {
    balance = Math.max(0, roundCurrency(grandTotal - Number(rawPaid)));
  } else {
    balance = 0;
  }

  let paidAmount: number;
  if (rawPaid !== undefined && rawPaid !== null && rawPaid !== "") {
    const candidatePaid = Math.max(0, roundCurrency(rawPaid));
    // Legacy rows may store paid_amount = 0 alongside balance = 0 on settled bills
    paidAmount = candidatePaid === 0 && balance === 0 && grandTotal > 0 ? grandTotal : candidatePaid;
  } else {
    paidAmount = Math.max(0, roundCurrency(grandTotal - balance));
  }

  const status = String(receipt.status || "COMPLETED").toUpperCase();
  let paymentStatusLabel: "PAID" | "PARTIAL DUE" | "UNPAID" | "VOID";
  if (status === "VOID") {
    paymentStatusLabel = "VOID";
  } else if (balance <= 0.009) {
    paymentStatusLabel = "PAID";
  } else if (paidAmount > 0) {
    paymentStatusLabel = "PARTIAL DUE";
  } else {
    paymentStatusLabel = "UNPAID";
  }

  return {
    invoiceNumber,
    dateTimeLabel,
    shopName,
    shopAddress,
    shopPhone,
    shopEmail,
    shopGstin,
    shopLogo,
    brandColor,
    thankYouMessage: cleanThankYou,
    hasNamedCustomer,
    customerName,
    customerPhone,
    customerAddress,
    paymentMethod: String(receipt.paymentMethod || receipt.payment_method || "Cash").trim(),
    status,
    items,
    subtotal,
    discount,
    gst,
    grandTotal,
    paidAmount,
    balance,
    paymentStatusLabel,
  };
}

/**
 * Generates clean INR WhatsApp share text without PDF links or localhost URLs.
 */
export function formatWhatsAppInvoiceText(
  invoice: NormalizedInvoiceData,
  opts?: { includeAttachmentNote?: boolean },
): string {
  const greeting = invoice.hasNamedCustomer ? `Hello ${invoice.customerName},` : "Hello,";
  const includeAttachmentNote = opts?.includeAttachmentNote !== false;

  const lines: string[] = [
    greeting,
    "",
    `Thank you for shopping with ${invoice.shopName}!`,
    "",
    `Invoice: ${invoice.invoiceNumber}`,
    ...(invoice.dateTimeLabel ? [`Date: ${invoice.dateTimeLabel}`] : []),
    "",
    `Total Amount: ${formatInrCurrency(invoice.grandTotal)}`,
    `Paid: ${formatInrCurrency(invoice.paidAmount)}`,
    `Balance: ${formatInrCurrency(invoice.balance)}`,
    "",
    includeAttachmentNote
      ? "Your invoice image is attached."
      : "Please find your invoice summary above.",
    ...(invoice.shopPhone ? ["", `Contact: ${invoice.shopPhone}`] : []),
    "",
    "Thank you for choosing us!",
  ];

  return lines.join("\n");
}

/**
 * Wraps arbitrary text within `maxWidth` pixels using caller-provided measurement.
 * Breaks long unspaced SKUs/names cleanly by character so text never clips horizontally.
 */
export function wrapTextForCanvas(
  text: string,
  maxWidth: number,
  measureWidth: (segment: string) => number,
): string[] {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return [""];

  const lines: string[] = [];
  const words = normalized.split(" ");
  let current = "";

  const pushCharWrappedWord = (word: string) => {
    let chunk = "";
    for (const ch of word) {
      const next = chunk + ch;
      if (chunk.length > 0 && measureWidth(next) > maxWidth) {
        lines.push(chunk);
        chunk = ch;
      } else {
        chunk = next;
      }
    }
    if (chunk) current = chunk;
  };

  for (const word of words) {
    if (!current) {
      if (measureWidth(word) <= maxWidth) {
        current = word;
      } else {
        pushCharWrappedWord(word);
      }
      continue;
    }

    const candidate = `${current} ${word}`;
    if (measureWidth(candidate) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = "";
      if (measureWidth(word) <= maxWidth) {
        current = word;
      } else {
        pushCharWrappedWord(word);
      }
    }
  }

  if (current) {
    lines.push(current);
  }
  return lines.length > 0 ? lines : [""];
}

export function defaultMeasureWidthApprox(segment: string): number {
  return segment.length * 10.5;
}

/**
 * Computes exact page chunks and heights so short/medium bills produce a single tall
 * image while very long invoices split cleanly into sequential pages without omitting items.
 */
export function planInvoiceImagePages(
  invoice: NormalizedInvoiceData,
  measureItemWidth: (segment: string) => number = defaultMeasureWidthApprox,
  measureMetaWidth: (segment: string) => number = defaultMeasureWidthApprox,
): InvoiceImagePagePlan[] {
  const itemColMaxWidth = 370;
  const lineHeight = 25;
  const rowBasePadding = 24;

  const measuredRows: PlannedInvoiceRow[] = invoice.items.map((item) => {
    const nameLines = wrapTextForCanvas(item.name, itemColMaxWidth, measureItemWidth);
    const hasPerItemDiscount = item.discount > 0;
    const extraLine = hasPerItemDiscount ? 20 : 0;
    const rowHeight = Math.max(54, nameLines.length * lineHeight + rowBasePadding + extraLine);
    return {
      item,
      nameLines,
      rowHeight,
    };
  });

  const shopNameLines = wrapTextForCanvas(
    invoice.shopName,
    380,
    (seg) => measureMetaWidth(seg) * 1.45,
  );
  const addressLines = invoice.shopAddress
    ? wrapTextForCanvas(invoice.shopAddress, 380, measureMetaWidth)
    : [];
  const contactSegments = [
    invoice.shopPhone ? `Ph: ${invoice.shopPhone}` : "",
    invoice.shopEmail ? invoice.shopEmail : "",
  ].filter(Boolean);

  // Shop text starts at y=32 next to an 80px logo box; leave a 24px gap before the customer card.
  const firstHeaderHeight = Math.max(
    32 + 80 + 24,
    56 +
      Math.max(1, shopNameLines.length) * 30 +
      (addressLines.length > 0 ? addressLines.length * 22 + 4 : 0) +
      (contactSegments.length > 0 ? 24 : 0) +
      (invoice.shopGstin ? 24 : 0),
  );
  const continuationHeaderHeight = 112;

  const customerCardHeight = invoice.customerAddress ? 124 : 104;
  const tableHeaderHeight = 46;
  const summaryRowsCount = 5 + (invoice.discount > 0 ? 1 : 0);
  const summaryHeight = 48 + summaryRowsCount * 34 + 34;

  const footerThankYouLines = wrapTextForCanvas(invoice.thankYouMessage, 760, measureMetaWidth);
  const footerHeight = 96 + footerThankYouLines.length * 24;
  const continuationFooterHeight = 76;

  // Check if everything fits on a single tall PNG comfortably
  const totalRowsHeight = measuredRows.reduce((sum, r) => sum + r.rowHeight, 0);
  const singlePageTotalHeight =
    firstHeaderHeight +
    customerCardHeight +
    tableHeaderHeight +
    totalRowsHeight +
    summaryHeight +
    footerHeight +
    40;

  if (singlePageTotalHeight <= INVOICE_MAX_PAGE_HEIGHT) {
    return [
      {
        pageNumber: 1,
        totalPages: 1,
        width: INVOICE_IMAGE_WIDTH,
        height: Math.max(680, singlePageTotalHeight),
        isFirstPage: true,
        isLastPage: true,
        rows: measuredRows,
        headerHeight: firstHeaderHeight,
        customerCardHeight,
        tableHeaderHeight,
        tableRowsHeight: totalRowsHeight,
        summaryHeight,
        footerHeight,
      },
    ];
  }

  // Partition items sequentially across multiple pages while keeping summary + footer attached to last page
  const pageChunks: PlannedInvoiceRow[][] = [];
  let cursor = 0;

  while (cursor < measuredRows.length) {
    const isFirst = pageChunks.length === 0;
    const headerH = isFirst ? firstHeaderHeight + customerCardHeight : continuationHeaderHeight;
    const budgetForRows = INVOICE_MAX_PAGE_HEIGHT - headerH - tableHeaderHeight - continuationFooterHeight - 30;
    const currentChunk: PlannedInvoiceRow[] = [];
    let usedRowHeight = 0;

    while (cursor < measuredRows.length) {
      const nextRow = measuredRows[cursor];
      if (currentChunk.length > 0 && usedRowHeight + nextRow.rowHeight > budgetForRows) {
        break;
      }
      currentChunk.push(nextRow);
      usedRowHeight += nextRow.rowHeight;
      cursor++;
    }
    pageChunks.push(currentChunk);
  }

  // Ensure last page has enough headroom for summary + full footer without exceeding max height
  const lastChunk = pageChunks[pageChunks.length - 1];
  const isOnlyOneChunk = pageChunks.length === 1;
  const lastHeaderH = isOnlyOneChunk ? firstHeaderHeight + customerCardHeight : continuationHeaderHeight;
  const lastRowsH = lastChunk.reduce((s, r) => s + r.rowHeight, 0);
  if (
    lastHeaderH + tableHeaderHeight + lastRowsH + summaryHeight + footerHeight + 30 >
      INVOICE_MAX_PAGE_HEIGHT &&
    lastChunk.length > 1
  ) {
    // Move overflow tail rows into an additional clean final page so summary never clips
    const movedRows: PlannedInvoiceRow[] = [];
    let remainingH = lastRowsH;
    while (
      lastChunk.length > 1 &&
      lastHeaderH + tableHeaderHeight + remainingH + continuationFooterHeight + 30 >
        INVOICE_MAX_PAGE_HEIGHT - summaryHeight
    ) {
      const popped = lastChunk.pop()!;
      movedRows.unshift(popped);
      remainingH -= popped.rowHeight;
    }
    if (movedRows.length > 0) {
      pageChunks.push(movedRows);
    }
  }

  const totalPages = pageChunks.length;
  return pageChunks.map((rows, index) => {
    const pageNumber = index + 1;
    const isFirstPage = pageNumber === 1;
    const isLastPage = pageNumber === totalPages;
    const headerHeight = isFirstPage ? firstHeaderHeight : continuationHeaderHeight;
    const custH = isFirstPage ? customerCardHeight : 0;
    const rowsH = rows.reduce((s, r) => s + r.rowHeight, 0);
    const sumH = isLastPage ? summaryHeight : 0;
    const footH = isLastPage ? footerHeight : continuationFooterHeight;
    return {
      pageNumber,
      totalPages,
      width: INVOICE_IMAGE_WIDTH,
      height: headerHeight + custH + tableHeaderHeight + rowsH + sumH + footH + 30,
      isFirstPage,
      isLastPage,
      rows,
      headerHeight,
      customerCardHeight: custH,
      tableHeaderHeight,
      tableRowsHeight: rowsH,
      summaryHeight: sumH,
      footerHeight: footH,
    };
  });
}

export function buildWhatsAppDirectUrl(text: string, rawPhone?: string | null): string {
  const normalizedPhone = normalizeWhatsAppPhoneNumber(rawPhone);
  const encodedText = encodeURIComponent(text);
  if (normalizedPhone) {
    return `https://wa.me/${normalizedPhone}?text=${encodedText}`;
  }
  return `https://wa.me/?text=${encodedText}`;
}
