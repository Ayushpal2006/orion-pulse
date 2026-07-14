const KOLKATA_TIME_ZONE = "Asia/Kolkata";

function coerceDateValue(value: string | Date | number | null | undefined): Date {
  if (value === null || value === undefined) return new Date();
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);

  const raw = String(value).trim();
  if (!raw) return new Date();

  const normalized = raw.replace(" ", "T");
  const hasTimezone = /Z$|[+-]\d{2}:\d{2}$/.test(normalized);
  const looksLikeDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(normalized);
  const candidate = looksLikeDateOnly ? `${normalized}T00:00:00` : normalized;

  return new Date(hasTimezone ? candidate : `${candidate}Z`);
}

export function parseDbTimestamp(ts: string | Date | number | null | undefined): Date {
  return coerceDateValue(ts);
}

export function getCurrentUtcString(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

export function formatToKolkataDate(ts: string | Date | number | null | undefined): string {
  const date = coerceDateValue(ts);
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: KOLKATA_TIME_ZONE,
  }).format(date);
}

export function formatToKolkataTime(ts: string | Date | number | null | undefined): string {
  const date = coerceDateValue(ts);
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: KOLKATA_TIME_ZONE,
  }).format(date);
}

export function formatToKolkataDateTime(ts: string | Date | number | null | undefined): string {
  const date = coerceDateValue(ts);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: KOLKATA_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
  
  const parts = formatter.formatToParts(date);
  const partMap = new Map(parts.map(p => [p.type, p.value]));
  
  const day = partMap.get("day") || "01";
  const month = partMap.get("month") || "Jan";
  const year = partMap.get("year") || "2026";
  const hour = partMap.get("hour") || "12";
  const minute = partMap.get("minute") || "00";
  const dayPeriod = (partMap.get("dayPeriod") || "AM").toUpperCase();
  
  return `${day} ${month} ${year} ${hour}:${minute} ${dayPeriod}`;
}
