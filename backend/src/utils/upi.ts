// Single source of truth for UPI deep links (NPCI "upi://pay" URI). Receipts, PDFs, ESC/POS
// printing and branding previews all build from here so they encode the same payload.

// NPCI VPA shape: handle "@" PSP. Handles allow letters, digits, ".", "-" and "_".
const VPA_PATTERN = /^[a-zA-Z0-9._-]{1,256}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/;

export function normalizeVpa(raw: string | null | undefined): string | null {
  const vpa = (raw ?? "").trim();
  return VPA_PATTERN.test(vpa) ? vpa : null;
}

/**
 * Returns "" when the store has no valid VPA, so callers never render a QR that pays nobody.
 * `pa` stays unescaped: a validated VPA only contains URI-safe characters, and several UPI
 * apps reject "%40" in place of "@".
 */
export function buildUpiUri(opts: {
  vpa: string | null | undefined;
  payeeName: string;
  amountPaise?: number | null;
}): string {
  const vpa = normalizeVpa(opts.vpa);
  if (!vpa) return "";

  let uri = `upi://pay?pa=${vpa}&pn=${encodeURIComponent(opts.payeeName.trim() || "Store")}`;
  if (opts.amountPaise != null && Number.isFinite(opts.amountPaise) && opts.amountPaise > 0) {
    uri += `&am=${(Math.round(opts.amountPaise) / 100).toFixed(2)}`;
  }
  return `${uri}&cu=INR`;
}
