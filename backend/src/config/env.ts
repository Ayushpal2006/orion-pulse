import { z } from "zod";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

console.log("Starting Orion Backend...");
console.log("Loading environment...");

// Load local .env if available in Node environment
try {
  const p = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
  } else {
    dotenv.config();
  }
} catch (_) {
  // In serverless / Cloudflare Workers runtime, environment bindings are provided natively
}

const envSchema = z.object({
  PORT: z.coerce.number().default(8080),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DB_TYPE: z.enum(["postgres"]).default("postgres"),
  DATABASE_PROVIDER: z.enum(["postgres"]).default("postgres"),
  DATABASE_URL: z.string().default("postgresql://postgres:postgres@localhost:5432/orion").refine(
    (val) => val.startsWith("postgres://") || val.startsWith("postgresql://"),
    { message: "DATABASE_URL must be a valid PostgreSQL connection string starting with postgres:// or postgresql://" }
  ),
  BASE_URL: z.string().optional(),
  JWT_SECRET: z.string().default("orion-pos-secret-key-change-in-prod"),
  JWT_EXPIRES_IN: z.string().default("24h"),
  ADMIN_EMAIL: z.string().email().default("admin@orion.com"),
  ADMIN_PASSWORD: z.string().default("admin123"),
  ALLOWED_ORIGINS: z.string().default("http://localhost:3000,http://localhost:8081"),
  TRUST_PROXY: z.string().default("1"),

  // Google Integration API config
  GOOGLE_SYNC_ENABLED: z.coerce.number().default(0).transform((val) => val === 1),
  GOOGLE_SHEET_ID: z.string().optional(),
  GOOGLE_CLIENT_EMAIL: z.string().optional(),
  GOOGLE_PRIVATE_KEY: z.string().optional(),

  // Cloudinary Config
  CLOUDINARY_URL: z.string().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
}).superRefine((data, ctx) => {
  // Fail fast if Google Sync is enabled but service configuration is missing
  if (data.GOOGLE_SYNC_ENABLED) {
    if (!data.GOOGLE_CLIENT_EMAIL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["GOOGLE_CLIENT_EMAIL"],
        message: "GOOGLE_CLIENT_EMAIL is required when GOOGLE_SYNC_ENABLED is 1",
      });
    }
    if (!data.GOOGLE_PRIVATE_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["GOOGLE_PRIVATE_KEY"],
        message: "GOOGLE_PRIVATE_KEY is required when GOOGLE_SYNC_ENABLED is 1",
      });
    }
    if (!data.GOOGLE_SHEET_ID) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["GOOGLE_SHEET_ID"],
        message: "GOOGLE_SHEET_ID is required when GOOGLE_SYNC_ENABLED is 1",
      });
    }
  }

  // Enforcement in production
  if (data.NODE_ENV === "production") {
    // BASE_URL is optional in serverless as it dynamically derives from Request URL
  }
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error("❌ Environment validation warning:", JSON.stringify(result.error.format(), null, 2));
}

const parsedData = result.success ? result.data : ({} as any);

export const env = {
  PORT: parsedData.PORT || 8080,
  NODE_ENV: parsedData.NODE_ENV || (process.env.NODE_ENV as any) || "production",
  DB_TYPE: parsedData.DB_TYPE || "postgres",
  DATABASE_PROVIDER: parsedData.DATABASE_PROVIDER || "postgres",
  DATABASE_URL: process.env.DATABASE_URL || parsedData.DATABASE_URL || "",
  JWT_SECRET: process.env.JWT_SECRET || parsedData.JWT_SECRET || "orion-pos-secret-key-change-in-prod",
  JWT_EXPIRES_IN: parsedData.JWT_EXPIRES_IN || "24h",
  ADMIN_EMAIL: parsedData.ADMIN_EMAIL || "admin@orion.com",
  ADMIN_PASSWORD: parsedData.ADMIN_PASSWORD || "admin123",
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || parsedData.ALLOWED_ORIGINS || "*",
  TRUST_PROXY: parsedData.TRUST_PROXY || "1",
  GOOGLE_SYNC_ENABLED: Boolean(parsedData.GOOGLE_SYNC_ENABLED),
  GOOGLE_SHEET_ID: parsedData.GOOGLE_SHEET_ID,
  GOOGLE_CLIENT_EMAIL: parsedData.GOOGLE_CLIENT_EMAIL,
  GOOGLE_PRIVATE_KEY: parsedData.GOOGLE_PRIVATE_KEY,
  CLOUDINARY_URL: parsedData.CLOUDINARY_URL,
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || parsedData.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || parsedData.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || parsedData.CLOUDINARY_API_SECRET,
  BASE_URL: process.env.BASE_URL || parsedData.BASE_URL || "http://localhost:8080"
};
export type EnvType = typeof env;
