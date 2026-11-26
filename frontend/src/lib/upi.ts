// Single source of truth for NPCI "upi://pay" URI formatting on the client.
// Mirrors backend/src/utils/upi.ts so offline receipts, test prints, HTML receipts,
// and ESC/POS thermal drivers generate identical UPI payment QRs.

const VPA_PATTERN = /^[a-zA-Z0-9._-]{1,256}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/;

export function normalizeVpa(raw: string | null | undefined): string | null {
  const vpa = (raw ?? "").trim();
  return VPA_PATTERN.test(vpa) ? vpa : null;
}

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

/**
 * Verifies whether an existing QR string is a genuine NPCI upi://pay link with a valid VPA.
 */
export function isValidUpiUri(uri: string | null | undefined): boolean {
  const trimmed = (uri ?? "").trim();
  if (!trimmed.toLowerCase().startsWith("upi://pay?")) return false;
  try {
    const query = trimmed.slice(trimmed.indexOf("?") + 1);
    const params = new URLSearchParams(query);
    return normalizeVpa(params.get("pa")) !== null;
  } catch {
    return false;
  }
}
