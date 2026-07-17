import dotenv from "dotenv";
import path from "path";
dotenv.config();

import { db } from "./db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Database connection string from env:", process.env.DATABASE_URL);
  try {
    const result = await db.execute(sql`SELECT 1 as val`);
    console.log("Database Query Success:", result.rows || result);
  } catch (err: any) {
    console.error("Failed to connect or query DB:", err.stack || err);
  }
}

main();
