const parseAllowedOrigins = (originsStr?: string): string[] => {
  if (!originsStr) return [];
  return originsStr.split(",").map((o) => o.trim().replace(/\/+$/, "")).filter(Boolean);
};

/** Explicit allowlist. A bare "*" is honoured only outside production. */
export function isOriginAllowed(origin: string, allowedList: string | undefined, nodeEnv: string): boolean {
  if (nodeEnv === "development") return true;
  const cleanOrigin = origin.trim().replace(/\/+$/, "");
  const allowed = parseAllowedOrigins(allowedList);
  return (
    allowed.includes(cleanOrigin) ||
    (nodeEnv !== "production" && allowed.includes("*")) ||
    allowed.some((a) => a.startsWith("https://*.") && cleanOrigin.startsWith("https://") && cleanOrigin.endsWith(a.slice("https://*".length)))
  );
}
