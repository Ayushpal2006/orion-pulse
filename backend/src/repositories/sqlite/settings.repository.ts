import { ISettingsRepository } from "../interfaces/ISettingsRepository";
import { DatabaseAdapter } from "../../database";
import dbProxy from "../../database";

export class SQLiteSettingsRepository implements ISettingsRepository {
  constructor(private db: DatabaseAdapter = dbProxy) {}

  async getAll(tx?: DatabaseAdapter): Promise<Record<string, string>> {
    const client = tx || this.db;
    const rows = await client.query<{ key: string; value: string }>("SELECT * FROM settings");
    const settingsObj: Record<string, string> = {};
    for (const row of rows) {
      settingsObj[row.key] = row.value;
    }
    return settingsObj;
  }

  async get(key: string, fallback = "", tx?: DatabaseAdapter): Promise<string> {
    const client = tx || this.db;
    const row = await client.queryOne<{ value: string }>(
      "SELECT value FROM settings WHERE key = ?",
      [key]
    );
    return row ? row.value : fallback;
  }

  async set(key: string, value: string, tx?: DatabaseAdapter): Promise<void> {
    const client = tx || this.db;
    await client.execute(
      "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
      [key, value]
    );
  }

  async setMany(settings: Record<string, string>, tx?: DatabaseAdapter): Promise<void> {
    const client = tx || this.db;
    await client.transaction(async (txClient) => {
      for (const [key, value] of Object.entries(settings)) {
        await txClient.execute(
          "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
          [key, String(value ?? "")]
        );
      }
    });
  }
}
