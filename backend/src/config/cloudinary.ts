import { env } from "./env";

export const cloudinaryConfig = {
  cloudName: env.CLOUDINARY_CLOUD_NAME || "",
  apiKey: env.CLOUDINARY_API_KEY || "",
  apiSecret: env.CLOUDINARY_API_SECRET || "",
  url: env.CLOUDINARY_URL || "",
  isConfigured: !!(env.CLOUDINARY_URL || (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET)),
};
