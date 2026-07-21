import { z } from "zod";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

console.log("Starting Orion Backend...");
console.log("Loading environment...");

// Load environment variables from cwd, backend/.env or relative to __dirname
const candidatePaths = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "backend/.env"),
  path.resolve(__dirname, "../../.env"),
  path.resolve(__dirname, "../../../backend/.env"),
];

for (const p of candidatePaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p, quiet: true } as any);
    break;
  }
}
if (!process.env.DATABASE_URL) {
  dotenv.config({ quiet: true } as any);
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
    if (!data.BASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["BASE_URL"],
        message: "BASE_URL environment variable is required in production mode",
      });
    }
    if (data.JWT_SECRET === "orion-pos-secret-key-change-in-prod") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["JWT_SECRET"],
        message: "JWT_SECRET must be customized in production",
      });
    }
  }
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error("❌ Environment validation failed:", JSON.stringify(result.error.format(), null, 2));
  process.exit(1);
}

export const env = {
  ...result.data,
  BASE_URL: result.data.BASE_URL || "http://localhost:8080"
};
export type EnvType = typeof env;
