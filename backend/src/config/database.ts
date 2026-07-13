import { env } from "./env";

export const databaseConfig = {
  type: env.DATABASE_PROVIDER,
  sqlite: {
    filename: env.DATABASE_URL,
  },
  postgres: {
    connectionString: env.DATABASE_URL,
  }
};
