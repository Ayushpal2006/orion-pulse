import { db } from "../db";
import { stores, organizations, settings } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { getTenantContext } from "../db/context";

export interface UnifiedBranding {
  logo: string;
  businessName: string;
  gst: string;
  phone: string;
  email: string;
  address: string;
  website: string;
  footer: string;
  returnPolicy: string;
  terms: string;
  upi: string;
  qr: string;
  receiptHeader: string;
  primaryColor: string;
  receiptTemplate: string;
  pdfTemplate: string;
  qrPosition: string;
}

export class BrandingService {
  /**
   * Single Source of Truth for tenant branding across all print & invoice outputs.
   * Resolves branding dynamically using storeId and orgId context.
   */
  static async getBranding(storeId?: number, orgId?: number): Promise<UnifiedBranding> {
    const ctx = getTenantContext();
    const targetStoreId = storeId && storeId > 0 ? storeId : ctx.currentStoreId;
    const targetOrgId = orgId && orgId > 0 ? orgId : ctx.organizationId;

    let storeRecord: any = null;
    let orgRecord: any = null;

    if (targetStoreId && targetStoreId > 0) {
      const storeWhereClause = (targetOrgId && targetOrgId > 0)
        ? and(eq(stores.id, targetStoreId), eq(stores.organization_id, targetOrgId))
        : eq(stores.id, targetStoreId);

      const [st] = await db.select().from(stores).where(storeWhereClause).limit(1);
      storeRecord = st;
    }

    const resolvedOrgId = targetOrgId || storeRecord?.organization_id;
    if (resolvedOrgId && resolvedOrgId > 0) {
      const [org] = await db.select().from(organizations).where(eq(organizations.id, resolvedOrgId)).limit(1);
      orgRecord = org;
    }

    const settingsMap: Record<string, string> = {};
    if (targetStoreId && targetStoreId > 0) {
      const rows = await db.select().from(settings).where(eq(settings.store_id, targetStoreId));
      for (const row of rows) {
        settingsMap[row.key] = row.value;
      }
    }

    const businessName = settingsMap.shop_name || settingsMap.storeName || settingsMap.store_name || storeRecord?.name || "Store";
    const gst = settingsMap.shop_gstin || settingsMap.gstin || storeRecord?.gst_number || orgRecord?.gst_number || "";
    const phone = settingsMap.shop_phone || settingsMap.phone || settingsMap.storePhone || storeRecord?.phone || orgRecord?.phone || "";
    const email = settingsMap.shop_email || settingsMap.email || settingsMap.storeEmail || orgRecord?.email || "";
    const address = settingsMap.shop_address || settingsMap.address || settingsMap.storeAddress || storeRecord?.address || orgRecord?.address || "";
    const logo = settingsMap.logo || settingsMap.logoUrl || settingsMap.logo_url || storeRecord?.logo_url || orgRecord?.logo_url || "";
    const upi = settingsMap.shop_upi_id || settingsMap.upiId || settingsMap.upi_id || "";
    const website = settingsMap.website || settingsMap.business_website || "https://apkabill.in";
    const footer = settingsMap.receipt_footer || settingsMap.receiptFooter || "Thank you for shopping with us\n*** Thank you — visit again ***";
    const returnPolicy = settingsMap.exchange_policy || "Items can be exchanged within 7 days in original condition.";
    const terms = settingsMap.terms_and_conditions || settingsMap.termsAndConditions || settingsMap.invoice_footer || returnPolicy;

    return {
      logo,
      businessName,
      gst,
      phone,
      email,
      address,
      website,
      footer,
      returnPolicy,
      terms,
      upi,
      qr: upi ? `upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent(businessName)}` : "",
      receiptHeader: settingsMap.invoice_header || settingsMap.receiptHeader || settingsMap.receipt_header || "",
      primaryColor: settingsMap.primary_color || settingsMap.accentColor || settingsMap.primaryColor || "#0f172a",
      receiptTemplate: settingsMap.receipt_template || settingsMap.receiptTemplate || "Classic",
      pdfTemplate: settingsMap.pdf_invoice_template || "Professional A4",
      qrPosition: settingsMap.qr_position || settingsMap.qrPosition || "Bottom",
    };
  }
}
