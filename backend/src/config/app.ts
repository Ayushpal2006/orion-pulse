import { env } from "./env";

export const appConfig = {
  port: env.PORT,
  env: env.NODE_ENV,
  baseUrl: env.BASE_URL,
  cloudinaryUrl: env.CLOUDINARY_URL,
};
