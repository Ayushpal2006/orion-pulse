import { ISupplierPaymentRepository } from "../interfaces/ISupplierPaymentRepository";
import { SupplierPayment } from "../../types/supplier-payment.types";
import { db } from "../../db";
import { supplier_payments, suppliers } from "../../db/schema";
import { eq, and, desc, or, sql, gte, lte, like } from "drizzle-orm";
import { getStoreId } from "../../db/context";

export class PostgresSupplierPaymentRepository implements ISupplierPaymentRepository {
  async create(paymentData: any, tx?: any): Promise<SupplierPayment> {
    const client = tx || db;
    const storeId = getStoreId() || 1;

    const [created] = await client
      .insert(supplier_payments)
      .values({
        store_id: storeId,
        supplier_id: paymentData.supplier_id,
        payment_number: paymentData.payment_number,
        amount: paymentData.amount,
        payment_method: paymentData.payment_method,
        reference_number: paymentData.reference_number || null,
        notes: paymentData.notes || null,
        payment_date: paymentData.payment_date ? new Date(paymentData.payment_date) : new Date(),
        created_by: paymentData.created_by || "System",
      })
      .returning();

    if (!created) {
      throw new Error("Failed to insert supplier payment record");
    }

    return {
      ...created,
      payment_date: created.payment_date.toISOString(),
      created_at: created.created_at.toISOString(),
    } as SupplierPayment;
  }

  async getAll(
    params?: {
      q?: string;
      startDate?: string;
      endDate?: string;
      supplier_id?: number;
    },
    tx?: any
  ): Promise<SupplierPayment[]> {
    const client = tx || db;
    const storeId = getStoreId();
    const conditions: any[] = [];

    if (storeId !== undefined) {
      conditions.push(eq(supplier_payments.store_id, storeId));
    }

    if (params?.supplier_id) {
      conditions.push(eq(supplier_payments.supplier_id, params.supplier_id));
    }

    if (params?.q) {
      const searchLike = `%${params.q}%`;
      conditions.push(
        or(
          like(supplier_payments.payment_number, searchLike),
          like(supplier_payments.reference_number, searchLike),
          like(suppliers.name, searchLike)
        )
      );
    }

    if (params?.startDate) {
      conditions.push(gte(supplier_payments.payment_date, new Date(params.startDate)));
    }

    if (params?.endDate) {
      conditions.push(lte(supplier_payments.payment_date, new Date(params.endDate)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await client
      .select({
        id: supplier_payments.id,
        store_id: supplier_payments.store_id,
        supplier_id: supplier_payments.supplier_id,
        payment_number: supplier_payments.payment_number,
        amount: supplier_payments.amount,
        payment_method: supplier_payments.payment_method,
        reference_number: supplier_payments.reference_number,
        notes: supplier_payments.notes,
        payment_date: supplier_payments.payment_date,
        created_by: supplier_payments.created_by,
        created_at: supplier_payments.created_at,
        supplier_name: suppliers.name,
      })
      .from(supplier_payments)
      .leftJoin(suppliers, eq(supplier_payments.supplier_id, suppliers.id))
      .where(whereClause)
      .orderBy(desc(supplier_payments.id));

    return rows.map((r: any) => ({
      ...r,
      payment_date: r.payment_date.toISOString(),
      created_at: r.created_at.toISOString(),
    }));
  }

  async getById(id: number, tx?: any): Promise<SupplierPayment | null> {
    const client = tx || db;
    const storeId = getStoreId();
    let cond = eq(supplier_payments.id, id);

    if (storeId !== undefined) {
      cond = and(cond, eq(supplier_payments.store_id, storeId)) as any;
    }

    const [payment] = await client
      .select({
        id: supplier_payments.id,
        store_id: supplier_payments.store_id,
        supplier_id: supplier_payments.supplier_id,
        payment_number: supplier_payments.payment_number,
        amount: supplier_payments.amount,
        payment_method: supplier_payments.payment_method,
        reference_number: supplier_payments.reference_number,
        notes: supplier_payments.notes,
        payment_date: supplier_payments.payment_date,
        created_by: supplier_payments.created_by,
        created_at: supplier_payments.created_at,
        supplier_name: suppliers.name,
      })
      .from(supplier_payments)
      .innerJoin(suppliers, eq(supplier_payments.supplier_id, suppliers.id))
      .where(cond)
      .limit(1);

    if (!payment) return null;

    return {
      ...payment,
      payment_date: payment.payment_date.toISOString(),
      created_at: payment.created_at.toISOString(),
    } as SupplierPayment;
  }
}
