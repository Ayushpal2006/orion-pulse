import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { subDays, startOfMonth, subMonths, endOfMonth, startOfYear } from "date-fns";

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
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: KOLKATA_TIME_ZONE,
  }).format(date);
}

export function getKolkataDateString(date: Date = new Date()): string {
  return formatInTimeZone(date, KOLKATA_TIME_ZONE, "yyyyMMdd");
}

export function getUtcBoundariesForFilter(filter: string, startDate?: string, endDate?: string): { start: Date; end: Date } {
  const now = new Date();
  
  // Calculate today's year, month, and day in Asia/Kolkata
  const year = parseInt(formatInTimeZone(now, KOLKATA_TIME_ZONE, "yyyy"), 10);
  const month = parseInt(formatInTimeZone(now, KOLKATA_TIME_ZONE, "M"), 10) - 1; // 0-indexed month
  const day = parseInt(formatInTimeZone(now, KOLKATA_TIME_ZONE, "d"), 10);
  
  // Construct a date representing local day at noon to avoid any offset shifts
  const currentKolkataNoon = new Date(Date.UTC(year, month, day, 12, 0, 0));
  const todayStr = formatInTimeZone(currentKolkataNoon, KOLKATA_TIME_ZONE, "yyyy-MM-dd");

  let startStr = "";
  let endStr = "";

  switch (filter) {
    case "today":
      startStr = `${todayStr} 00:00:00.000`;
      endStr = `${todayStr} 23:59:59.999`;
      break;
    case "yesterday": {
      const yesterdayStr = formatInTimeZone(subDays(currentKolkataNoon, 1), KOLKATA_TIME_ZONE, "yyyy-MM-dd");
      startStr = `${yesterdayStr} 00:00:00.000`;
      endStr = `${yesterdayStr} 23:59:59.999`;
      break;
    }
    case "last7": {
      const startLimitStr = formatInTimeZone(subDays(currentKolkataNoon, 6), KOLKATA_TIME_ZONE, "yyyy-MM-dd");
      startStr = `${startLimitStr} 00:00:00.000`;
      endStr = `${todayStr} 23:59:59.999`;
      break;
    }
    case "last30": {
      const startLimitStr = formatInTimeZone(subDays(currentKolkataNoon, 29), KOLKATA_TIME_ZONE, "yyyy-MM-dd");
      startStr = `${startLimitStr} 00:00:00.000`;
      endStr = `${todayStr} 23:59:59.999`;
      break;
    }
    case "thisMonth": {
      const startLimitStr = formatInTimeZone(startOfMonth(currentKolkataNoon), KOLKATA_TIME_ZONE, "yyyy-MM-dd");
      startStr = `${startLimitStr} 00:00:00.000`;
      endStr = `${todayStr} 23:59:59.999`;
      break;
    }
    case "lastMonth": {
      const lastMonthDate = subMonths(currentKolkataNoon, 1);
      const startLimitStr = formatInTimeZone(startOfMonth(lastMonthDate), KOLKATA_TIME_ZONE, "yyyy-MM-dd");
      const endLimitStr = formatInTimeZone(endOfMonth(lastMonthDate), KOLKATA_TIME_ZONE, "yyyy-MM-dd");
      startStr = `${startLimitStr} 00:00:00.000`;
      endStr = `${endLimitStr} 23:59:59.999`;
      break;
    }
    case "thisYear": {
      const startLimitStr = formatInTimeZone(startOfYear(currentKolkataNoon), KOLKATA_TIME_ZONE, "yyyy-MM-dd");
      startStr = `${startLimitStr} 00:00:00.000`;
      endStr = `${todayStr} 23:59:59.999`;
      break;
    }
    case "custom": {
      if (!startDate) {
        startStr = `${todayStr} 00:00:00.000`;
        endStr = `${todayStr} 23:59:59.999`;
      } else {
        startStr = `${startDate} 00:00:00.000`;
        const endLimitStr = endDate || startDate;
        endStr = `${endLimitStr} 23:59:59.999`;
      }
      break;
    }
    default:
      startStr = `${todayStr} 00:00:00.000`;
      endStr = `${todayStr} 23:59:59.999`;
      break;
  }

  const start = fromZonedTime(startStr, KOLKATA_TIME_ZONE);
  const end = fromZonedTime(endStr, KOLKATA_TIME_ZONE);

  return { start, end };
}

