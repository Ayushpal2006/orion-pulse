import { ISettingsRepository } from "../interfaces/ISettingsRepository";
import { db } from "../../db";
import { settings, stores } from "../../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getTenantContext, TenantContext } from "../../db/context";

async function resolveStoreIdForContext(ctx: TenantContext, client: any): Promise<number> {
  if (ctx.currentStoreId && ctx.currentStoreId > 0) {
    return ctx.currentStoreId;
  }
  if (ctx.organizationId && ctx.organizationId > 0) {
    const [st] = await client
      .select({ id: stores.id })
      .from(stores)
      .where(eq(stores.organization_id, ctx.organizationId))
      .orderBy(desc(stores.is_default), stores.id)
      .limit(1);
    if (st) return st.id;
  }
  return ctx.currentStoreId || 1;
}

export class PostgresSettingsRepository implements ISettingsRepository {
  async getAll(tx?: any): Promise<Record<string, string>> {
    const client = tx || db;
    const ctx = getTenantContext();
    const storeId = await resolveStoreIdForContext(ctx, client);
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
    const ctx = getTenantContext();
    const storeId = await resolveStoreIdForContext(ctx, client);
    const rows = await client
      .select({ value: settings.value })
      .from(settings)
      .where(and(eq(settings.store_id, storeId), eq(settings.key, key)))
      .limit(1);

    return rows[0]?.value ?? fallback;
  }

  async set(key: string, value: string, tx?: any): Promise<void> {
    const client = tx || db;
    const ctx = getTenantContext();
    const storeId = await resolveStoreIdForContext(ctx, client);
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
    const ctx = getTenantContext();
    const storeId = await resolveStoreIdForContext(ctx, client);
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
