import { ISettingsRepository } from "../interfaces/ISettingsRepository";
import { db } from "../../db";
import { settings, stores, organizations } from "../../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getTenantContext, TenantContext } from "../../db/context";

async function resolveStoreIdForContext(ctx: TenantContext, client: any): Promise<number> {
  if (ctx.organizationId && ctx.organizationId > 0) {
    if (ctx.currentStoreId && ctx.currentStoreId > 0) {
      const [stMatch] = await client
        .select({ id: stores.id })
        .from(stores)
        .where(and(eq(stores.id, ctx.currentStoreId), eq(stores.organization_id, ctx.organizationId)))
        .limit(1);
      if (stMatch) return stMatch.id;
    }
    const [st] = await client
      .select({ id: stores.id })
      .from(stores)
      .where(eq(stores.organization_id, ctx.organizationId))
      .orderBy(desc(stores.is_default), stores.id)
      .limit(1);
    if (st) return st.id;
  }
  return ctx.currentStoreId || 0;
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

    let orgRecord: any = null;
    if (storeRecord?.organization_id) {
      const [org] = await client
        .select()
        .from(organizations)
        .where(eq(organizations.id, storeRecord.organization_id))
        .limit(1);
      orgRecord = org;
    } else if (ctx.organizationId && ctx.organizationId > 0) {
      const [org] = await client
        .select()
        .from(organizations)
        .where(eq(organizations.id, ctx.organizationId))
        .limit(1);
      orgRecord = org;
    }

    const rows = await client
      .select()
      .from(settings)
      .where(eq(settings.store_id, storeId));

    const settingsObj: Record<string, string> = {
      shop_name: storeRecord?.name || "",
      shop_gstin: storeRecord?.gst_number || orgRecord?.gst_number || "",
      shop_phone: storeRecord?.phone || orgRecord?.phone || "",
      shop_address: storeRecord?.address || orgRecord?.address || "",
      shop_email: orgRecord?.email || "",
      logo: storeRecord?.logo_url || orgRecord?.logo_url || "",
      inv_prefix: orgRecord?.invoice_prefix || "INV-",
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
      const storeWhereClause = (ctx.organizationId && ctx.organizationId > 0)
        ? and(eq(stores.id, storeId), eq(stores.organization_id, ctx.organizationId))
        : eq(stores.id, storeId);

      const [st] = await client
        .select()
        .from(stores)
        .where(storeWhereClause)
        .limit(1);
      if (st) {
        if (key === "shop_name" && st.name) return st.name;
        if (key === "shop_gstin" && st.gst_number) return st.gst_number;
        if (key === "shop_phone" && st.phone) return st.phone;
        if (key === "shop_address" && st.address) return st.address;
        if (key === "logo" && st.logo_url) return st.logo_url;

        if (st.organization_id) {
          const [org] = await client
            .select()
            .from(organizations)
            .where(eq(organizations.id, st.organization_id))
            .limit(1);
          if (org) {
            if (key === "shop_gstin" && org.gst_number) return org.gst_number;
            if (key === "shop_phone" && org.phone) return org.phone;
            if (key === "shop_address" && org.address) return org.address;
            if (key === "shop_email" && org.email) return org.email;
            if (key === "inv_prefix" && org.invoice_prefix) return org.invoice_prefix;
            if (key === "logo" && org.logo_url) return org.logo_url;
          }
        }
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

    // Also update stores / organizations table row if matching core identity attributes
    if (storeId > 0) {
      if (key === "shop_name") await client.update(stores).set({ name: value, updated_at: new Date() }).where(eq(stores.id, storeId));
      else if (key === "shop_gstin") await client.update(stores).set({ gst_number: value, updated_at: new Date() }).where(eq(stores.id, storeId));
      else if (key === "shop_phone") await client.update(stores).set({ phone: value, updated_at: new Date() }).where(eq(stores.id, storeId));
      else if (key === "shop_address") await client.update(stores).set({ address: value, updated_at: new Date() }).where(eq(stores.id, storeId));
      else if (key === "logo") await client.update(stores).set({ logo_url: value, updated_at: new Date() }).where(eq(stores.id, storeId));
    }
  }

  async setMany(settingsObj: Record<string, string>, tx?: any): Promise<void> {
    const ctx = getTenantContext();
    const storeId = await resolveStoreIdForContext(ctx, tx || db);

    for (const [key, value] of Object.entries(settingsObj)) {
      const valStr = String(value ?? "");
      await db
        .insert(settings)
        .values({ store_id: storeId, key, value: valStr })
        .onConflictDoUpdate({
          target: [settings.store_id, settings.key],
          set: { value: valStr },
        });

      if (storeId > 0) {
        if (key === "shop_name") await db.update(stores).set({ name: valStr, updated_at: new Date() }).where(eq(stores.id, storeId));
        else if (key === "shop_gstin") await db.update(stores).set({ gst_number: valStr, updated_at: new Date() }).where(eq(stores.id, storeId));
        else if (key === "shop_phone") await db.update(stores).set({ phone: valStr, updated_at: new Date() }).where(eq(stores.id, storeId));
        else if (key === "shop_address") await db.update(stores).set({ address: valStr, updated_at: new Date() }).where(eq(stores.id, storeId));
        else if (key === "logo") await db.update(stores).set({ logo_url: valStr, updated_at: new Date() }).where(eq(stores.id, storeId));
      }
    }
  }
}
