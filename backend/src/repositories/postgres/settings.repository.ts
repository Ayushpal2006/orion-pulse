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

    const [storeRecord] = await client
      .select()
      .from(stores)
      .where(eq(stores.id, storeId))
      .limit(1);

    const rows = await client
      .select()
      .from(settings)
      .where(eq(settings.store_id, storeId));

    const settingsObj: Record<string, string> = {
      shop_name: storeRecord?.name || "",
      shop_gstin: storeRecord?.gst_number || "",
      shop_phone: storeRecord?.phone || "",
      shop_address: storeRecord?.address || "",
      logo: storeRecord?.logo_url || "",
    };

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

    if (rows[0]?.value !== undefined && rows[0]?.value !== null) {
      return rows[0].value;
    }

    if (storeId > 0) {
      const [st] = await client
        .select()
        .from(stores)
        .where(eq(stores.id, storeId))
        .limit(1);
      if (st) {
        if (key === "shop_name" && st.name) return st.name;
        if (key === "shop_gstin" && st.gst_number) return st.gst_number;
        if (key === "shop_phone" && st.phone) return st.phone;
        if (key === "shop_address" && st.address) return st.address;
        if (key === "logo" && st.logo_url) return st.logo_url;
      }
    }

    return fallback;
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

    // Also update stores table row if matching core identity attributes
    if (storeId > 0) {
      if (key === "shop_name") await client.update(stores).set({ name: value, updated_at: new Date() }).where(eq(stores.id, storeId));
      else if (key === "shop_gstin") await client.update(stores).set({ gst_number: value, updated_at: new Date() }).where(eq(stores.id, storeId));
      else if (key === "shop_phone") await client.update(stores).set({ phone: value, updated_at: new Date() }).where(eq(stores.id, storeId));
      else if (key === "shop_address") await client.update(stores).set({ address: value, updated_at: new Date() }).where(eq(stores.id, storeId));
      else if (key === "logo") await client.update(stores).set({ logo_url: value, updated_at: new Date() }).where(eq(stores.id, storeId));
    }
  }

  async setMany(settingsObj: Record<string, string>, tx?: any): Promise<void> {
    const client = tx || db;
    const ctx = getTenantContext();
    const storeId = await resolveStoreIdForContext(ctx, client);

    await client.transaction(async (txClient: any) => {
      for (const [key, value] of Object.entries(settingsObj)) {
        const valStr = String(value ?? "");
        await txClient
          .insert(settings)
          .values({ store_id: storeId, key, value: valStr })
          .onConflictDoUpdate({
            target: [settings.store_id, settings.key],
            set: { value: valStr },
          });

        if (storeId > 0) {
          if (key === "shop_name") await txClient.update(stores).set({ name: valStr, updated_at: new Date() }).where(eq(stores.id, storeId));
          else if (key === "shop_gstin") await txClient.update(stores).set({ gst_number: valStr, updated_at: new Date() }).where(eq(stores.id, storeId));
          else if (key === "shop_phone") await txClient.update(stores).set({ phone: valStr, updated_at: new Date() }).where(eq(stores.id, storeId));
          else if (key === "shop_address") await txClient.update(stores).set({ address: valStr, updated_at: new Date() }).where(eq(stores.id, storeId));
          else if (key === "logo") await txClient.update(stores).set({ logo_url: valStr, updated_at: new Date() }).where(eq(stores.id, storeId));
        }
      }
    });
  }
}
