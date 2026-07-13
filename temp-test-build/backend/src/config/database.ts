import { env } from "./env";

export const databaseConfig = {
  type: env.DB_TYPE,
  sqlite: {
    filename: env.DATABASE_URL,
  },
  postgres: {
    connectionString: env.DATABASE_URL,
  }
};
