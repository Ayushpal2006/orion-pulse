import { env } from "./env";

export const googleConfig = {
  syncEnabled: env.GOOGLE_SYNC_ENABLED,
  sheetId: env.GOOGLE_SHEET_ID || "",
  clientEmail: env.GOOGLE_CLIENT_EMAIL || "",
  privateKey: env.GOOGLE_PRIVATE_KEY || "",
};
