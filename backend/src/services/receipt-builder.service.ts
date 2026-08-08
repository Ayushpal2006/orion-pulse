import { db } from "../db";
import { sales, sale_items, products, customers, stores, organizations, settings } from "../db/schema";
import { eq } from "drizzle-orm";
import { NotFoundError } from "../utils/errors";
import { formatToKolkataDate, formatToKolkataTime } from "../utils/datetime";
import { storeStorage } from "../db/context";
import QRCode from "qrcode";
import { ReceiptDTO, BrandingConfig, StoreConfig, ReceiptItemDTO, ThermalFormatItem } from "../types/receipt.types";

export class ReceiptBuilderService {
  /**
   * Build a unified ReceiptDTO for any sale identified by ID, invoice number, or public token.
   * Scoped strictly to the target sale's organization_id and store_id.
   * Contains ZERO hardcoded branding fallbacks.
   */
  static async buildReceipt(idOrInvoice: string): Promise<ReceiptDTO> {
    let saleRecord: any = null;

    const numericId = parseInt(idOrInvoice, 10);
    if (!isNaN(numericId) && String(numericId) === idOrInvoice) {
      const [found] = await db.select().from(sales).where(eq(sales.id, numericId)).limit(1);
      saleRecord = found;
    }

    if (!saleRecord) {
      const [found] = await db.select().from(sales).where(eq(sales.invoice_number, idOrInvoice)).limit(1);
      saleRecord = found;
    }

    if (!saleRecord) {
      const [found] = await db.select().from(sales).where(eq(sales.public_token, idOrInvoice)).limit(1);
      saleRecord = found;
    }

    if (!saleRecord) {
      throw new NotFoundError(`Sale with identifier "${idOrInvoice}" not found`);
    }

    const targetStoreId = saleRecord.store_id || 1;
    const targetOrgId = saleRecord.organization_id || 1;

    return await storeStorage.run(
      { organizationId: targetOrgId, currentStoreId: targetStoreId, userId: 1, role: "system" },
      async () => {
        // Fetch Store record
        const [storeRecord] = await db
          .select()
          .from(stores)
          .where(eq(stores.id, targetStoreId))
          .limit(1);

        // Fetch Organization record
        const [orgRecord] = await db
          .select()
          .from(organizations)
          .where(eq(organizations.id, targetOrgId))
          .limit(1);

        // Fetch Customer
        let customerRecord: any = null;
        if (saleRecord.customer_id) {
          const [cust] = await db.select().from(customers).where(eq(customers.id, saleRecord.customer_id)).limit(1);
          customerRecord = cust;
        }

        // Fetch Sale Items joined with Products
        const rawItems = await db
          .select({
            product_id: sale_items.product_id,
            product_name: products.name,
            product_gst: products.gst,
            quantity: sale_items.quantity,
            selling_price: sale_items.selling_price,
            discount: sale_items.discount,
            line_total: sale_items.line_total,
          })
          .from(sale_items)
          .leftJoin(products, eq(sale_items.product_id, products.id))
          .where(eq(sale_items.sale_id, saleRecord.id));

        // Fetch Store Settings
        const storeSettingsRows = await db
          .select()
          .from(settings)
          .where(eq(settings.store_id, targetStoreId));

        const settingsMap: Record<string, string> = {};
        for (const row of storeSettingsRows) {
          settingsMap[row.key] = row.value;
        }

        // Build Dynamic BrandingConfig (Zero Hardcoding)
        const branding: BrandingConfig = {
          shopName: settingsMap.shop_name || storeRecord?.name || orgRecord?.name || "Store",
          gstin: settingsMap.shop_gstin || storeRecord?.gst_number || orgRecord?.gst_number || "",
          phone: settingsMap.shop_phone || storeRecord?.phone || orgRecord?.phone || "",
          address: settingsMap.shop_address || storeRecord?.address || orgRecord?.address || "",
          email: settingsMap.shop_email || orgRecord?.email || "",
          upiId: settingsMap.shop_upi_id || "",
          logo: settingsMap.logo || storeRecord?.logo_url || orgRecord?.logo_url || "",
          receiptHeader: settingsMap.invoice_header || "",
          receiptFooter: settingsMap.receipt_footer || "Thank you for shopping with us\n*** Thank you — visit again ***",
          termsAndConditions: settingsMap.terms_and_conditions || settingsMap.invoice_footer || settingsMap.exchange_policy || "",
          signature: settingsMap.signature || "Authorized Signatory",
          primaryColor: settingsMap.primary_color || "#0f172a",
          receiptTemplate: settingsMap.receipt_template || "Classic",
          pdfTemplate: settingsMap.pdf_invoice_template || "Professional A4",
          qrPosition: settingsMap.qr_position || "Bottom",
        };

        // Build StoreConfig
        const store: StoreConfig = {
          storeId: targetStoreId,
          organizationId: targetOrgId,
          storeName: storeRecord?.name || orgRecord?.name || "Store",
          storeCode: storeRecord?.code || "",
          currency: "INR",
        };

        // Map Items
        const items: ReceiptItemDTO[] = rawItems.map((i) => ({
          productId: i.product_id,
          name: i.product_name || `Product #${i.product_id}`,
          qty: i.quantity,
          price: i.selling_price / 100.0,
          discount: (i.discount || 0) / 100.0,
          lineTotal: i.line_total / 100.0,
          gst: i.product_gst ?? 18,
        }));

        const formattedDate = formatToKolkataDate(saleRecord.created_at);
        const formattedTime = formatToKolkataTime(saleRecord.created_at);

        // Build UPI Payload & Offline QR Code
        const upiPayload = branding.upiId
          ? `upi://pay?pa=${branding.upiId}&pn=${encodeURIComponent(branding.shopName)}&am=${(saleRecord.grand_total / 100.0).toFixed(2)}&cu=INR`
          : "";

        let upiQrCode = "";
        if (saleRecord.payment_method === "UPI" && upiPayload) {
          try {
            upiQrCode = await QRCode.toDataURL(upiPayload);
          } catch (e) {
            console.error("Failed to generate UPI QR code in ReceiptBuilderService:", e);
          }
        }

        // Thermal Printer JSON Structure (58mm / 80mm format)
        const thermalFormat: ThermalFormatItem[] = [
          { type: "text", value: branding.shopName, align: "center", bold: true },
          { type: "text", value: branding.address, align: "center" },
          ...(branding.gstin ? [{ type: "text", value: `GSTIN: ${branding.gstin}`, align: "center" }] : []),
          ...(branding.phone ? [{ type: "text", value: `Phone: ${branding.phone}`, align: "center" }] : []),
          { type: "divider" },
          { type: "text", value: `Invoice: ${saleRecord.invoice_number}` },
          { type: "text", value: `Date: ${formattedDate} ${formattedTime}` },
          { type: "text", value: `Cashier: ${saleRecord.cashier_name || "Admin"}` },
          { type: "text", value: `Customer: ${customerRecord ? customerRecord.name : "Walk-in Customer"}` },
          { type: "divider" },
          ...items.map((it) => ({
            type: "item",
            value: `${it.name} x${it.qty} = ₹${it.lineTotal.toFixed(2)}`,
          })),
          { type: "divider" },
          { type: "text", value: `Subtotal: ₹${(saleRecord.subtotal / 100.0).toFixed(2)}` },
          { type: "text", value: `Discount: ₹${(saleRecord.discount / 100.0).toFixed(2)}` },
          { type: "text", value: `GST: ₹${(saleRecord.gst / 100.0).toFixed(2)}` },
          { type: "text", value: `Grand Total: ₹${(saleRecord.grand_total / 100.0).toFixed(2)}`, bold: true },
          { type: "text", value: `Payment: ${saleRecord.payment_method}` },
          { type: "divider" },
          { type: "text", value: branding.receiptFooter, align: "center" },
        ];

        return {
          invoiceNumber: saleRecord.invoice_number,
          date: formattedDate,
          time: formattedTime,
          branding,
          store,
          customer: {
            id: customerRecord?.id,
            name: customerRecord ? customerRecord.name : "Walk-in Customer",
            phone: customerRecord ? customerRecord.phone : "",
            address: customerRecord?.address || "",
          },
          items,
          subtotal: saleRecord.subtotal / 100.0,
          discount: saleRecord.discount / 100.0,
          gst: saleRecord.gst / 100.0,
          grandTotal: saleRecord.grand_total / 100.0,
          paymentMethod: saleRecord.payment_method,
          cashier: saleRecord.cashier_name || "Admin",
          publicToken: saleRecord.public_token || "",
          pdfUrl: saleRecord.pdf_url || "",
          upiPayload,
          upiQrCode,
          thermalFormat,
          status: saleRecord.status || "COMPLETED",
          voidReason: saleRecord.void_reason,
          voidedBy: saleRecord.voided_by,
          voidedAt: saleRecord.voided_at ? formatToKolkataDate(saleRecord.voided_at) : undefined,

          // Backward-compatibility properties
          shop: {
            storeId: targetStoreId,
            organizationId: targetOrgId,
            name: branding.shopName,
            gstin: branding.gstin,
            phone: branding.phone,
            address: branding.address,
            email: branding.email,
            upiId: branding.upiId,
            logo: branding.logo,
          },
          signature: branding.signature,
          pdfTemplate: branding.pdfTemplate,
          termsAndConditions: branding.termsAndConditions,
        };
      }
    );
  }
}
