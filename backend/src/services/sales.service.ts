import { saleRepository, customerRepository, settingsRepository } from "../repositories";
import { NotFoundError } from "../utils/errors";
import { Sale, SaleDetailResponse } from "../types/checkout.types";
import { formatToKolkataDate, formatToKolkataTime } from "../utils/datetime";
import QRCode from "qrcode";
import { db } from "../db";
import { sales, sale_items, products, customers, audit_logs, inventory_logs, stores, organizations, settings } from "../db/schema";
import { eq, and, or } from "drizzle-orm";
import { storeStorage, getTenantContext } from "../db/context";
import { SyncQueueManager } from "./sync.service";
import { InventoryMovementService } from "./inventory-movement.service";
import { ReceiptBuilderService } from "./receipt-builder.service";
import { ReceiptDTO } from "../types/receipt.types";

export type ReceiptResponse = ReceiptDTO;

export class SalesService {
  private saleRepo = saleRepository;
  private customerRepo = customerRepository;
  private movementService = new InventoryMovementService();

  async getAll(): Promise<Sale[]> {
    return this.saleRepo.getAll();
  }

  async getByCustomerPhone(phone: string): Promise<Sale[]> {
    return this.saleRepo.getByCustomerPhone(phone);
  }

  async getById(id: number): Promise<SaleDetailResponse> {
    const sale = await this.saleRepo.getById(id);
    if (!sale) {
      throw new NotFoundError(`Sale with ID ${id} not found`);
    }

    const customer = sale.customer_id ? await this.customerRepo.getById(sale.customer_id) : null;
    const items = await this.saleRepo.getSaleItems(sale.id);

    return {
      sale,
      customer,
      items,
      totals: {
        subtotal: sale.subtotal,
        discount: sale.discount,
        gst: sale.gst,
        grand_total: sale.grand_total,
      },
    };
  }

  async getByInvoice(invoice: string): Promise<SaleDetailResponse> {
    const sale = await this.saleRepo.getByInvoice(invoice);
    if (!sale) {
      throw new NotFoundError(`Sale with invoice number "${invoice}" not found`);
    }

    const customer = sale.customer_id ? await this.customerRepo.getById(sale.customer_id) : null;
    const items = await this.saleRepo.getSaleItems(sale.id);

    return {
      sale,
      customer,
      items,
      totals: {
        subtotal: sale.subtotal,
        discount: sale.discount,
        gst: sale.gst,
        grand_total: sale.grand_total,
      },
    };
  }

  async getTodaySales(): Promise<Sale[]> {
    return this.saleRepo.getTodaySales();
  }

  async getReceipt(idOrInvoice: string): Promise<ReceiptDTO> {
    return await ReceiptBuilderService.buildReceipt(idOrInvoice);
  }

  async voidInvoice(saleId: number, reason: string, voidedBy: string, userId: number): Promise<any> {
    const { organizationId, currentStoreId } = getTenantContext();
    const result = await db.transaction(async (tx) => {
      const numericId = parseInt(String(saleId), 10);
      const isNumeric = !isNaN(numericId) && String(numericId) === String(saleId);

      const idOrInvoiceCond = isNumeric
        ? or(eq(sales.id, numericId), eq(sales.invoice_number, String(saleId)))
        : eq(sales.invoice_number, String(saleId));

      const whereClause = (organizationId && organizationId > 0)
        ? and(idOrInvoiceCond, eq(sales.organization_id, organizationId), eq(sales.store_id, currentStoreId))
        : and(idOrInvoiceCond, eq(sales.store_id, currentStoreId));

      const [sale] = await tx
        .select()
        .from(sales)
        .where(whereClause)
        .for("update");

      if (!sale) {
        throw new NotFoundError("Invoice not found or does not belong to your organization/store");
      }

      if (sale.status === "VOID" || sale.status === "voided") {
        // Idempotency: Return existing voided sale safely without duplicate inventory reversal
        return {
          sale,
          customer: null,
          products: [],
          idempotent: true,
        };
      }

      const storeId = sale.store_id;
      const orgId = sale.organization_id || organizationId || 1;

      // 2. Fetch sale items
      const items = await tx
        .select()
        .from(sale_items)
        .where(and(eq(sale_items.sale_id, saleId), eq(sale_items.store_id, storeId)));

      // 3. Restore inventory stock & log inventory movement
      const syncProductsList: any[] = [];
      for (const item of items) {
        const [product] = await tx
          .select()
          .from(products)
          .where(and(eq(products.id, item.product_id), eq(products.organization_id, orgId), eq(products.store_id, storeId)))
          .for("update");

        if (product) {
          const movementResult = await this.movementService.recordVoidInvoice(
            product.id,
            storeId,
            item.quantity,
            sale.invoice_number,
            voidedBy,
            `Voided invoice: ${reason}`,
            tx
          );
          const updatedProduct = movementResult.product;
          syncProductsList.push(updatedProduct);
        }
      }

      // 4. Reverse customer orders & lifetime spend
      let updatedCustomer = null;
      if (sale.customer_id) {
        const [customer] = await tx
          .select()
          .from(customers)
          .where(and(eq(customers.id, sale.customer_id), eq(customers.organization_id, orgId), eq(customers.store_id, storeId)))
          .for("update");

        if (customer && customer.phone !== "0000000000") {
          const [cust] = await tx
            .update(customers)
            .set({
              total_orders: Math.max(0, customer.total_orders - 1),
              lifetime_value: Math.max(0, customer.lifetime_value - sale.grand_total),
              updated_at: new Date(),
            })
            .where(and(eq(customers.id, customer.id), eq(customers.organization_id, orgId), eq(customers.store_id, storeId)))
            .returning();
          updatedCustomer = cust;
        }
      }

      // 5. Update status in sales table
      const [updatedSale] = await tx
        .update(sales)
        .set({
          status: "VOID",
          void_reason: reason,
          voided_by: voidedBy,
          voided_at: new Date(),
        })
        .where(and(eq(sales.id, saleId), eq(sales.organization_id, orgId), eq(sales.store_id, storeId)))
        .returning();

      // 6. Add to audit_logs with explicit organization_id
      await tx.insert(audit_logs).values({
        organization_id: orgId,
        store_id: storeId,
        user_id: userId,
        action: "INVOICE_VOID",
        details: `${voidedBy} voided Invoice ${sale.invoice_number}. Reason: ${reason}`,
      });

      return {
        sale: updatedSale,
        customer: updatedCustomer,
        products: syncProductsList,
      };
    });

    // 7. Enqueue Google Sheets Sync jobs
    try {
      const syncEnabled = (await settingsRepository.get("google_sync_enabled", "0")) === "1";
      if (syncEnabled) {
        const formattedDate = formatToKolkataDate(result.sale.created_at);
        const formattedTime = formatToKolkataTime(result.sale.created_at);
        
        SyncQueueManager.getInstance().enqueue("sale", {
          invoiceNumber: result.sale.invoice_number,
          date: formattedDate,
          time: formattedTime,
          cashier: result.sale.cashier_name,
          paymentMethod: result.sale.payment_method,
          subtotal: result.sale.subtotal / 100.0,
          discount: result.sale.discount / 100.0,
          gst: result.sale.gst / 100.0,
          grandTotal: result.sale.grand_total / 100.0,
          publicToken: result.sale.public_token,
          status: "VOID",
          voidReason: reason,
          voidDate: formatToKolkataDate(result.sale.voided_at!),
          voidTime: formatToKolkataTime(result.sale.voided_at!),
          voidBy: voidedBy,
        });

        if (result.customer) {
          SyncQueueManager.getInstance().enqueue("customer", result.customer);
        }

        for (const prod of result.products) {
          SyncQueueManager.getInstance().enqueue("product", prod);
        }
      }
    } catch (e) {
      console.error("❌ Failed to enqueue Google Sheets sync jobs on invoice void:", e);
    }

    return result;
  }

  async logAudit(storeId: number, userId: number, action: string, details: string): Promise<void> {
    const { organizationId } = getTenantContext();
    await db.insert(audit_logs).values({
      organization_id: organizationId && organizationId > 0 ? organizationId : null,
      store_id: storeId,
      user_id: userId,
      action,
      details,
    });
  }

  async editInvoice(
    saleId: number,
    data: {
      items: { productId: number; quantity: number; discount?: number }[];
      customerPhone?: string;
      customerName?: string;
      paymentMethod?: string;
      discountAmount?: number;
      taxAmount?: number;
    },
    actingUser: { userId: number; role: string; name?: string }
  ): Promise<any> {
    const { organizationId, currentStoreId } = getTenantContext();
    return db.transaction(async (tx) => {
      // 1. Lock existing sale strictly scoped to authenticated tenant
      const whereClause = (organizationId && organizationId > 0)
        ? and(eq(sales.id, saleId), eq(sales.organization_id, organizationId), eq(sales.store_id, currentStoreId))
        : and(eq(sales.id, saleId), eq(sales.store_id, currentStoreId));

      const [oldSale] = await tx
        .select()
        .from(sales)
        .where(whereClause)
        .for("update");

      if (!oldSale) {
        throw new NotFoundError(`Sale with ID ${saleId} not found or does not belong to your organization/store`);
      }
      if (oldSale.status === "VOID" || oldSale.status === "DELETED") {
        throw new Error(`Cannot edit an invoice that is ${oldSale.status}`);
      }

      const storeId = oldSale.store_id;
      const orgId = oldSale.organization_id || organizationId || 1;

      // 2. Fetch old sale items
      const oldItems = await tx
        .select()
        .from(sale_items)
        .where(and(eq(sale_items.sale_id, saleId), eq(sale_items.store_id, storeId)));

      // 3. Revert stock for old items
      for (const oldItem of oldItems) {
        const [product] = await tx
          .select()
          .from(products)
          .where(and(eq(products.id, oldItem.product_id), eq(products.organization_id, orgId), eq(products.store_id, storeId)))
          .for("update");

        if (product) {
          await this.movementService.recordMovement({
            storeId,
            movementType: "VOID_INVOICE",
            productId: oldItem.product_id,
            quantity: oldItem.quantity,
            referenceType: "INVOICE",
            referenceId: oldSale.invoice_number,
            reason: `Bill edit reversal for invoice ${oldSale.invoice_number}`,
            createdBy: actingUser.name || actingUser.role || "Admin",
          }, tx);
        }
      }

      // Remove old sale_items
      await tx.delete(sale_items).where(and(eq(sale_items.sale_id, saleId), eq(sale_items.store_id, storeId)));

      // 4. Resolve customer strictly within tenant
      let customerId = oldSale.customer_id;
      if (data.customerPhone !== undefined) {
        const phone = data.customerPhone.trim();
        if (phone && phone !== "0000000000") {
          const [existingCustomer] = await tx
            .select()
            .from(customers)
            .where(and(eq(customers.phone, phone), eq(customers.organization_id, orgId), eq(customers.store_id, storeId)));

          if (existingCustomer) {
            customerId = existingCustomer.id;
          } else {
            const [newCustomer] = await tx
              .insert(customers)
              .values({
                organization_id: orgId,
                store_id: storeId,
                name: data.customerName || "Walk-in Customer",
                phone,
                notes: "Created during bill edit",
              })
              .returning();
            customerId = newCustomer.id;
          }
        } else {
          customerId = null;
        }
      }

      // 5. Apply new sale items & calculate total
      let subtotalPaise = 0;
      let totalGstPaise = 0;
      const newItemsData: any[] = [];

      for (const itemRequest of data.items) {
        const [product] = await tx
          .select()
          .from(products)
          .where(and(eq(products.id, itemRequest.productId), eq(products.organization_id, orgId), eq(products.store_id, storeId)))
          .for("update");

        if (!product) {
          throw new NotFoundError(`Product ID ${itemRequest.productId} not found in your store`);
        }
        if (product.stock < itemRequest.quantity) {
          throw new Error(`Insufficient stock for product ${product.name}. Available: ${product.stock}`);
        }

        const sellingPricePaise = product.selling_price;
        const itemDiscountPaise = Math.round((itemRequest.discount || 0) * 100);
        const lineTotalPaise = (sellingPricePaise - itemDiscountPaise) * itemRequest.quantity;
        const itemGstPaise = Math.round((lineTotalPaise * (product.gst || 0)) / 100);

        subtotalPaise += lineTotalPaise;
        totalGstPaise += itemGstPaise;

        // Update product stock for SALE
        await this.movementService.recordMovement({
          storeId,
          movementType: "SALE",
          productId: itemRequest.productId,
          quantity: itemRequest.quantity,
          referenceType: "INVOICE",
          referenceId: oldSale.invoice_number,
          reason: `Bill edit application for invoice ${oldSale.invoice_number}`,
          createdBy: actingUser.name || actingUser.role || "Admin",
        }, tx);

        newItemsData.push({
          organization_id: orgId,
          store_id: storeId,
          sale_id: saleId,
          product_id: itemRequest.productId,
          quantity: itemRequest.quantity,
          selling_price: sellingPricePaise,
          discount: itemDiscountPaise,
          line_total: lineTotalPaise,
        });
      }

      // Insert new sale items
      await tx.insert(sale_items).values(newItemsData);

      const discountPaise = data.discountAmount !== undefined ? Math.round(data.discountAmount * 100) : oldSale.discount;
      const finalGstPaise = data.taxAmount !== undefined ? Math.round(data.taxAmount * 100) : totalGstPaise;
      const grandTotalPaise = Math.max(0, subtotalPaise - discountPaise + finalGstPaise);

      // 6. Adjust Customer Stats
      if (oldSale.customer_id) {
        const [oldCust] = await tx
          .select()
          .from(customers)
          .where(and(eq(customers.id, oldSale.customer_id), eq(customers.organization_id, orgId), eq(customers.store_id, storeId)))
          .for("update");
        if (oldCust && oldCust.phone !== "0000000000") {
          await tx
            .update(customers)
            .set({
              total_orders: Math.max(0, oldCust.total_orders - 1),
              lifetime_value: Math.max(0, oldCust.lifetime_value - oldSale.grand_total),
              updated_at: new Date(),
            })
            .where(and(eq(customers.id, oldCust.id), eq(customers.organization_id, orgId), eq(customers.store_id, storeId)));
        }
      }

      if (customerId) {
        const [newCust] = await tx
          .select()
          .from(customers)
          .where(and(eq(customers.id, customerId), eq(customers.organization_id, orgId), eq(customers.store_id, storeId)))
          .for("update");
        if (newCust && newCust.phone !== "0000000000") {
          await tx
            .update(customers)
            .set({
              total_orders: newCust.total_orders + 1,
              lifetime_value: newCust.lifetime_value + grandTotalPaise,
              last_visit: new Date(),
              updated_at: new Date(),
            })
            .where(and(eq(customers.id, newCust.id), eq(customers.organization_id, orgId), eq(customers.store_id, storeId)));
        }
      }

      // 7. Update Sales record
      const [updatedSale] = await tx
        .update(sales)
        .set({
          customer_id: customerId,
          payment_method: data.paymentMethod || oldSale.payment_method,
          subtotal: subtotalPaise,
          discount: discountPaise,
          gst: finalGstPaise,
          grand_total: grandTotalPaise,
          paid_amount: grandTotalPaise,
          balance: 0,
        })
        .where(and(eq(sales.id, saleId), eq(sales.organization_id, orgId), eq(sales.store_id, storeId)))
        .returning();

      // 8. Log Audit with organization_id
      await tx.insert(audit_logs).values({
        organization_id: orgId,
        store_id: storeId,
        user_id: actingUser.userId,
        action: "INVOICE_EDIT",
        details: `${actingUser.name || actingUser.role} edited Invoice ${oldSale.invoice_number}. New Grand Total: Rs ${(grandTotalPaise / 100).toFixed(2)}`,
      });

      return updatedSale;
    });
  }

  async deleteInvoice(saleId: number, deletedBy: string, userId: number): Promise<any> {
    const { organizationId, currentStoreId } = getTenantContext();
    return db.transaction(async (tx) => {
      // 1. Fetch sale with lock for update strictly scoped to authenticated tenant
      const whereClause = (organizationId && organizationId > 0)
        ? and(eq(sales.id, saleId), eq(sales.organization_id, organizationId), eq(sales.store_id, currentStoreId))
        : and(eq(sales.id, saleId), eq(sales.store_id, currentStoreId));

      const [sale] = await tx
        .select()
        .from(sales)
        .where(whereClause)
        .for("update");

      if (!sale) {
        throw new NotFoundError("Invoice not found or does not belong to your organization/store");
      }

      if (sale.status === "DELETED") {
        throw new Error("Invoice is already deleted");
      }

      const storeId = sale.store_id;
      const orgId = sale.organization_id || organizationId || 1;

      // 2. If status was COMPLETED, restore inventory & customer stats
      if (sale.status === "COMPLETED") {
        const items = await tx
          .select()
          .from(sale_items)
          .where(and(eq(sale_items.sale_id, saleId), eq(sale_items.store_id, storeId)));

        for (const item of items) {
          const [product] = await tx
            .select()
            .from(products)
            .where(and(eq(products.id, item.product_id), eq(products.organization_id, orgId), eq(products.store_id, storeId)))
            .for("update");

          if (product) {
            await this.movementService.recordVoidInvoice(
              product.id,
              storeId,
              item.quantity,
              sale.invoice_number,
              deletedBy,
              `Soft deleted invoice ${sale.invoice_number}`,
              tx
            );
          }
        }

        if (sale.customer_id) {
          const [customer] = await tx
            .select()
            .from(customers)
            .where(and(eq(customers.id, sale.customer_id), eq(customers.organization_id, orgId), eq(customers.store_id, storeId)))
            .for("update");

          if (customer && customer.phone !== "0000000000") {
            await tx
              .update(customers)
              .set({
                total_orders: Math.max(0, customer.total_orders - 1),
                lifetime_value: Math.max(0, customer.lifetime_value - sale.grand_total),
                updated_at: new Date(),
              })
              .where(and(eq(customers.id, customer.id), eq(customers.organization_id, orgId), eq(customers.store_id, storeId)));
          }
        }
      }

      // 3. Update status to DELETED (Soft Delete)
      const [deletedSale] = await tx
        .update(sales)
        .set({
          status: "DELETED",
          void_reason: `Deleted by ${deletedBy}`,
          voided_by: deletedBy,
          voided_at: new Date(),
        })
        .where(and(eq(sales.id, saleId), eq(sales.organization_id, orgId), eq(sales.store_id, storeId)))
        .returning();

      // 4. Log Audit with explicit organization_id
      await tx.insert(audit_logs).values({
        organization_id: orgId,
        store_id: storeId,
        user_id: userId,
        action: "INVOICE_DELETE",
        details: `${deletedBy} soft-deleted Invoice ${sale.invoice_number}`,
      });

      return deletedSale;
    });
  }
}
