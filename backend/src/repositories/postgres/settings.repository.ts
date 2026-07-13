import { ISettingsRepository } from "../interfaces/ISettingsRepository";
import { db } from "../../db";
import { settings } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { getStoreId } from "../../db/context";

export class PostgresSettingsRepository implements ISettingsRepository {
  async getAll(tx?: any): Promise<Record<string, string>> {
    const client = tx || db;
    const storeId = getStoreId() || 1;
    const rows = await client
      .select()
      .from(settings)
      .where(eq(settings.store_id, storeId));

    const settingsObj: Record<string, string> = {};
    for (const row of rows) {
      settingsObj[row.key] = row.value;
    }
    return settingsObj;
  }

  async get(key: string, fallback = "", tx?: any): Promise<string> {
    const client = tx || db;
    const storeId = getStoreId() || 1;
    const rows = await client
      .select({ value: settings.value })
      .from(settings)
      .where(and(eq(settings.store_id, storeId), eq(settings.key, key)))
      .limit(1);

    return rows[0]?.value ?? fallback;
  }

  async set(key: string, value: string, tx?: any): Promise<void> {
    const client = tx || db;
    const storeId = getStoreId() || 1;
    await client
      .insert(settings)
      .values({ store_id: storeId, key, value })
      .onConflictDoUpdate({
        target: [settings.store_id, settings.key],
        set: { value },
      });
  }

  async setMany(settingsObj: Record<string, string>, tx?: any): Promise<void> {
    const client = tx || db;
    const storeId = getStoreId() || 1;
    await client.transaction(async (txClient: any) => {
      for (const [key, value] of Object.entries(settingsObj)) {
        await txClient
          .insert(settings)
          .values({ store_id: storeId, key, value: String(value ?? "") })
          .onConflictDoUpdate({
            target: [settings.store_id, settings.key],
            set: { value: String(value ?? "") },
          });
      }
    });
  }
}
