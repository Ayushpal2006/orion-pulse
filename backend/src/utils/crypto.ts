import crypto from "crypto";
import { env } from "../config/env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // Standard for GCM

function getDerivedKey(): Buffer {
  const secret = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY || env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("FATAL STARTUP ERROR: GOOGLE_TOKEN_ENCRYPTION_KEY environment variable is required in production.");
  }
  const effectiveSecret = secret || "orion-pos-default-encryption-secret-key-32b";
  return crypto.createHash("sha256").update(effectiveSecret).digest();
}

/**
 * Encrypts sensitive text (e.g., OAuth refresh token) using AES-256-GCM.
 * Output format: "iv_hex:auth_tag_hex:encrypted_hex"
 */
export function encryptToken(plainText: string): string {
  if (!plainText) return "";
  const key = getDerivedKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypts encrypted text back to original plain text.
 */
export function decryptToken(cipherText: string): string {
  if (!cipherText) return "";
  // Check if string is formatted as "iv:authTag:encrypted"
  const parts = cipherText.split(":");
  if (parts.length !== 3) {
    // If plaintext was unencrypted (legacy fallback safeguard)
    return cipherText;
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = getDerivedKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

// Export encrypt and decrypt aliases
export const encrypt = encryptToken;
export const decrypt = decryptToken;
