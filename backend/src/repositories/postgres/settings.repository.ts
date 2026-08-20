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
  if (ctx.currentStoreId && ctx.currentStoreId > 0) {
    return ctx.currentStoreId;
  }
  // Safe single-store fallback for legacy/unauthenticated calls
  const [defaultStore] = await client
    .select({ id: stores.id })
    .from(stores)
    .orderBy(desc(stores.is_default), stores.id)
    .limit(1);
  return defaultStore ? defaultStore.id : 1;
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
      storeName: storeRecord?.name || "",
      store_name: storeRecord?.name || "",
      shop_gstin: storeRecord?.gst_number || orgRecord?.gst_number || "",
      gstin: storeRecord?.gst_number || orgRecord?.gst_number || "",
      shop_phone: storeRecord?.phone || orgRecord?.phone || "",
      phone: storeRecord?.phone || orgRecord?.phone || "",
      storePhone: storeRecord?.phone || orgRecord?.phone || "",
      shop_address: storeRecord?.address || orgRecord?.address || "",
      address: storeRecord?.address || orgRecord?.address || "",
      storeAddress: storeRecord?.address || orgRecord?.address || "",
      shop_email: orgRecord?.email || "",
      email: orgRecord?.email || "",
      storeEmail: orgRecord?.email || "",
      logo: storeRecord?.logo_url || orgRecord?.logo_url || "",
      logoUrl: storeRecord?.logo_url || orgRecord?.logo_url || "",
      logo_url: storeRecord?.logo_url || orgRecord?.logo_url || "",
      inv_prefix: orgRecord?.invoice_prefix || "INV-",
      invoicePrefix: orgRecord?.invoice_prefix || "INV-",
      po_prefix: "PO-",
      purchasePrefix: "PO-",
      shop_upi_id: "",
      upiId: "",
      upi_id: "",
    };

    for (const row of rows) {
      settingsObj[row.key] = row.value;

      // Populate bidirectional aliases
      if (row.key === "shop_name" || row.key === "storeName" || row.key === "store_name") {
        settingsObj.shop_name = row.value;
        settingsObj.storeName = row.value;
        settingsObj.store_name = row.value;
      } else if (row.key === "shop_gstin" || row.key === "gstin") {
        settingsObj.shop_gstin = row.value;
        settingsObj.gstin = row.value;
      } else if (row.key === "shop_phone" || row.key === "phone" || row.key === "storePhone") {
        settingsObj.shop_phone = row.value;
        settingsObj.phone = row.value;
        settingsObj.storePhone = row.value;
      } else if (row.key === "shop_address" || row.key === "address" || row.key === "storeAddress") {
        settingsObj.shop_address = row.value;
        settingsObj.address = row.value;
        settingsObj.storeAddress = row.value;
      } else if (row.key === "shop_email" || row.key === "email" || row.key === "storeEmail") {
        settingsObj.shop_email = row.value;
        settingsObj.email = row.value;
        settingsObj.storeEmail = row.value;
      } else if (row.key === "logo" || row.key === "logoUrl" || row.key === "logo_url") {
        settingsObj.logo = row.value;
        settingsObj.logoUrl = row.value;
        settingsObj.logo_url = row.value;
      } else if (row.key === "shop_upi_id" || row.key === "upiId" || row.key === "upi_id") {
        settingsObj.shop_upi_id = row.value;
        settingsObj.upiId = row.value;
        settingsObj.upi_id = row.value;
      } else if (row.key === "inv_prefix" || row.key === "invoicePrefix") {
        settingsObj.inv_prefix = row.value;
        settingsObj.invoicePrefix = row.value;
      } else if (row.key === "po_prefix" || row.key === "purchasePrefix") {
        settingsObj.po_prefix = row.value;
        settingsObj.purchasePrefix = row.value;
      } else if (row.key === "tax_rate" || row.key === "taxRate") {
        settingsObj.tax_rate = row.value;
        settingsObj.taxRate = row.value;
      } else if (row.key === "low_stock_threshold" || row.key === "lowStockThreshold") {
        settingsObj.low_stock_threshold = row.value;
        settingsObj.lowStockThreshold = row.value;
      } else if (row.key === "receipt_header" || row.key === "receiptHeader") {
        settingsObj.receipt_header = row.value;
        settingsObj.receiptHeader = row.value;
      } else if (row.key === "receipt_footer" || row.key === "receiptFooter") {
        settingsObj.receipt_footer = row.value;
        settingsObj.receiptFooter = row.value;
      } else if (row.key === "terms_and_conditions" || row.key === "termsAndConditions") {
        settingsObj.terms_and_conditions = row.value;
        settingsObj.termsAndConditions = row.value;
      } else if (row.key === "primary_color" || row.key === "accentColor" || row.key === "primaryColor") {
        settingsObj.primary_color = row.value;
        settingsObj.accentColor = row.value;
        settingsObj.primaryColor = row.value;
      }
    }
    return settingsObj;
  }

  async get(key: string, fallback = "", tx?: any): Promise<string> {
    const client = tx || db;
    const ctx = getTenantContext();
    const storeId = await resolveStoreIdForContext(ctx, client);

    // Map query key to possible alias variants
    let searchKeys = [key];
    if (key === "shop_name" || key === "storeName" || key === "store_name") searchKeys = ["shop_name", "storeName", "store_name"];
    else if (key === "shop_gstin" || key === "gstin") searchKeys = ["shop_gstin", "gstin"];
    else if (key === "shop_phone" || key === "phone" || key === "storePhone") searchKeys = ["shop_phone", "phone", "storePhone"];
    else if (key === "shop_address" || key === "address" || key === "storeAddress") searchKeys = ["shop_address", "address", "storeAddress"];
    else if (key === "shop_email" || key === "email" || key === "storeEmail") searchKeys = ["shop_email", "email", "storeEmail"];
    else if (key === "logo" || key === "logoUrl" || key === "logo_url") searchKeys = ["logo", "logoUrl", "logo_url"];
    else if (key === "shop_upi_id" || key === "upiId" || key === "upi_id") searchKeys = ["shop_upi_id", "upiId", "upi_id"];
    else if (key === "inv_prefix" || key === "invoicePrefix") searchKeys = ["inv_prefix", "invoicePrefix"];
    else if (key === "po_prefix" || key === "purchasePrefix") searchKeys = ["po_prefix", "purchasePrefix"];

    for (const sk of searchKeys) {
      const rows = await client
        .select({ value: settings.value })
        .from(settings)
        .where(and(eq(settings.store_id, storeId), eq(settings.key, sk)))
        .limit(1);

      if (rows[0]?.value !== undefined && rows[0]?.value !== null) {
        return rows[0].value;
      }
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
        if ((key === "shop_name" || key === "storeName" || key === "store_name") && st.name) return st.name;
        if ((key === "shop_gstin" || key === "gstin") && st.gst_number) return st.gst_number;
        if ((key === "shop_phone" || key === "phone" || key === "storePhone") && st.phone) return st.phone;
        if ((key === "shop_address" || key === "address" || key === "storeAddress") && st.address) return st.address;
        if ((key === "logo" || key === "logoUrl" || key === "logo_url") && st.logo_url) return st.logo_url;

        if (st.organization_id) {
          const [org] = await client
            .select()
            .from(organizations)
            .where(eq(organizations.id, st.organization_id))
            .limit(1);
          if (org) {
            if ((key === "shop_gstin" || key === "gstin") && org.gst_number) return org.gst_number;
            if ((key === "shop_phone" || key === "phone" || key === "storePhone") && org.phone) return org.phone;
            if ((key === "shop_address" || key === "address" || key === "storeAddress") && org.address) return org.address;
            if ((key === "shop_email" || key === "email" || key === "storeEmail") && org.email) return org.email;
            if ((key === "inv_prefix" || key === "invoicePrefix") && org.invoice_prefix) return org.invoice_prefix;
            if ((key === "logo" || key === "logoUrl" || key === "logo_url") && org.logo_url) return org.logo_url;
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
    const valStr = String(value ?? "");

    await client
      .insert(settings)
      .values({ store_id: storeId, key, value: valStr })
      .onConflictDoUpdate({
        target: [settings.store_id, settings.key],
        set: { value: valStr },
      });

    // Also update stores table row if matching core identity attributes
    if (storeId > 0) {
      if (key === "shop_name" || key === "storeName" || key === "store_name") {
        await client.update(stores).set({ name: valStr, updated_at: new Date() }).where(eq(stores.id, storeId));
      } else if (key === "shop_gstin" || key === "gstin") {
        await client.update(stores).set({ gst_number: valStr, updated_at: new Date() }).where(eq(stores.id, storeId));
      } else if (key === "shop_phone" || key === "phone" || key === "storePhone") {
        await client.update(stores).set({ phone: valStr, updated_at: new Date() }).where(eq(stores.id, storeId));
      } else if (key === "shop_address" || key === "address" || key === "storeAddress") {
        await client.update(stores).set({ address: valStr, updated_at: new Date() }).where(eq(stores.id, storeId));
      } else if (key === "logo" || key === "logoUrl" || key === "logo_url") {
        await client.update(stores).set({ logo_url: valStr, updated_at: new Date() }).where(eq(stores.id, storeId));
      }
    }
  }

  async setMany(settingsObj: Record<string, string>, tx?: any): Promise<void> {
    const client = tx || db;
    const ctx = getTenantContext();
    const storeId = await resolveStoreIdForContext(ctx, client);

    for (const [key, value] of Object.entries(settingsObj)) {
      if (value === undefined || value === null) continue;
      const valStr = String(value);

      await client
        .insert(settings)
        .values({ store_id: storeId, key, value: valStr })
        .onConflictDoUpdate({
          target: [settings.store_id, settings.key],
          set: { value: valStr },
        });

      if (storeId > 0) {
        if (key === "shop_name" || key === "storeName" || key === "store_name") {
          await client.update(stores).set({ name: valStr, updated_at: new Date() }).where(eq(stores.id, storeId));
        } else if (key === "shop_gstin" || key === "gstin") {
          await client.update(stores).set({ gst_number: valStr, updated_at: new Date() }).where(eq(stores.id, storeId));
        } else if (key === "shop_phone" || key === "phone" || key === "storePhone") {
          await client.update(stores).set({ phone: valStr, updated_at: new Date() }).where(eq(stores.id, storeId));
        } else if (key === "shop_address" || key === "address" || key === "storeAddress") {
          await client.update(stores).set({ address: valStr, updated_at: new Date() }).where(eq(stores.id, storeId));
        } else if (key === "logo" || key === "logoUrl" || key === "logo_url") {
          await client.update(stores).set({ logo_url: valStr, updated_at: new Date() }).where(eq(stores.id, storeId));
        }
      }
    }
  }
}
