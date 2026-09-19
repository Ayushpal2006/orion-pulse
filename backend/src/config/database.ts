import { env } from "./env";

export const databaseConfig = {
  type: env.DATABASE_PROVIDER,
  sqlite: {
    filename: env.DATABASE_URL,
  },
  postgres: {
    get connectionString(): string {
      return process.env.DATABASE_URL || env.DATABASE_URL;
    },
  }
};
