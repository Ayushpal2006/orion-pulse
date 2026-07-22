import { db } from "../db";
import { supplier_payments, suppliers, supplier_ledger, purchase_orders } from "../db/schema";
import { eq, and, sql, desc, sum } from "drizzle-orm";
import { getStoreId } from "../db/context";
import { NotFoundError, ValidationError } from "../utils/errors";
import { supplierPaymentRepository, supplierLedgerRepository } from "../repositories";
import { CreateSupplierPaymentDTO, SupplierPayment, SupplierLedgerEntry } from "../types/supplier-payment.types";

export class SupplierPaymentService {
  async generateNextPaymentNumber(storeId: number, txClient?: any): Promise<string> {
    const client = txClient || db;
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const todayStr = `${yyyy}${mm}${dd}`;
    const prefix = `PMT-${todayStr}-`;

    const rows = await client
      .select({ payment_number: supplier_payments.payment_number })
      .from(supplier_payments)
      .where(and(
        eq(supplier_payments.store_id, storeId),
        sql`${supplier_payments.payment_number} LIKE ${prefix + "%"}`
      ))
      .orderBy(desc(supplier_payments.payment_number))
      .limit(1);

    let nextNum = 1;
    if (rows.length > 0) {
      const lastNumStr = rows[0].payment_number.substring(prefix.length);
      const lastNum = parseInt(lastNumStr, 10);
      if (!isNaN(lastNum)) {
        nextNum = lastNum + 1;
      }
    }

    return `${prefix}${String(nextNum).padStart(6, "0")}`;
  }

  async createPayment(data: CreateSupplierPaymentDTO): Promise<SupplierPayment> {
    const storeId = getStoreId();
    if (storeId === undefined) {
      throw new ValidationError("Store context is required");
    }

    if (!data.supplier_id) {
      throw new ValidationError("Supplier ID is required");
    }

    if (!data.amount || data.amount <= 0) {
      throw new ValidationError("Payment amount must be greater than zero");
    }

    if (!data.payment_method) {
      throw new ValidationError("Payment method is required");
    }

    return db.transaction(async (tx) => {
      // 1. Fetch & lock supplier record
      const [supplier] = await tx
        .select()
        .from(suppliers)
        .where(and(eq(suppliers.id, data.supplier_id), eq(suppliers.store_id, storeId)))
        .for("update");

      if (!supplier) {
        throw new NotFoundError(`Supplier with ID ${data.supplier_id} not found in this store`);
      }

      // Generate payment number
      const paymentNumber = await this.generateNextPaymentNumber(storeId, tx);

      // 2. Decrement supplier balance (outstanding payables goes down)
      const newBalance = supplier.current_balance - data.amount;
      await tx
        .update(suppliers)
        .set({ current_balance: newBalance })
        .where(eq(suppliers.id, data.supplier_id));

      // 3. Create payment record
      const created = await supplierPaymentRepository.create(
        {
          supplier_id: data.supplier_id,
          payment_number: paymentNumber,
          amount: data.amount,
          payment_method: data.payment_method,
          reference_number: data.reference_number || null,
          notes: data.notes || null,
          payment_date: data.payment_date || new Date().toISOString(),
          created_by: "System",
        },
        tx
      );

      // 4. Create ledger entry
      await supplierLedgerRepository.create(
        {
          supplier_id: data.supplier_id,
          transaction_type: "PAYMENT",
          amount: data.amount,
          balance: newBalance,
          reference: paymentNumber,
        },
        tx
      );

      return created;
    });
  }

  async getAllPayments(filters?: {
    q?: string;
    startDate?: string;
    endDate?: string;
    supplier_id?: number;
  }): Promise<SupplierPayment[]> {
    const storeId = getStoreId();
    if (storeId === undefined) {
      throw new ValidationError("Store context is required");
    }
    return supplierPaymentRepository.getAll(filters);
  }

  async getLedgerBySupplierId(
    supplierId: number,
    filters?: {
      startDate?: string;
      endDate?: string;
      transaction_type?: string;
    }
  ): Promise<SupplierLedgerEntry[]> {
    const storeId = getStoreId();
    if (storeId === undefined) {
      throw new ValidationError("Store context is required");
    }
    return supplierLedgerRepository.getBySupplierId(supplierId, filters);
  }

  async getSupplierReports(): Promise<any> {
    const storeId = getStoreId();
    if (storeId === undefined) {
      throw new ValidationError("Store context is required");
    }

    // 1. Total Payables (sum of current_balance for all suppliers with positive balance)
    const [totalPayablesRow] = await db
      .select({ sum: sql<number>`COALESCE(SUM(current_balance), 0)` })
      .from(suppliers)
      .where(and(eq(suppliers.store_id, storeId), eq(suppliers.is_active, 1), sql`current_balance > 0`));

    // 2. Outstanding Suppliers (list of suppliers where current_balance > 0, ordered desc)
    const outstandingSuppliers = await db
      .select()
      .from(suppliers)
      .where(and(eq(suppliers.store_id, storeId), eq(suppliers.is_active, 1), sql`current_balance > 0`))
      .orderBy(desc(suppliers.current_balance));

    // 3. Recent Payments (last 10 payment logs)
    const recentPayments = await supplierPaymentRepository.getAll({
      startDate: undefined,
      endDate: undefined,
      supplier_id: undefined,
    });

    // 4. Top Suppliers (suppliers sorted by purchase orders total volume)
    const topSuppliersRaw = await db
      .select({
        id: suppliers.id,
        name: suppliers.company_name,
        phone: suppliers.phone,
        total_purchases: sql<number>`COALESCE(SUM(${purchase_orders.grand_total}), 0)`,
      })
      .from(suppliers)
      .leftJoin(purchase_orders, eq(purchase_orders.supplier_id, suppliers.id))
      .where(and(eq(suppliers.store_id, storeId), eq(suppliers.is_active, 1)))
      .groupBy(suppliers.id, suppliers.company_name, suppliers.phone)
      .orderBy(desc(sql`COALESCE(SUM(${purchase_orders.grand_total}), 0)`))
      .limit(10);

    return {
      totalPayables: Number(totalPayablesRow?.sum || 0),
      outstandingSuppliers,
      recentPayments: recentPayments.slice(0, 10),
      topSuppliers: topSuppliersRaw.map((s) => ({
        id: s.id,
        name: s.name,
        phone: s.phone,
        totalPurchases: Number(s.total_purchases),
      })),
    };
  }
}
