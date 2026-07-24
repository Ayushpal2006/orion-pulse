import { ISupplierLedgerRepository } from "../interfaces/ISupplierLedgerRepository";
import { SupplierLedgerEntry } from "../../types/supplier-payment.types";
import { db } from "../../db";
import { supplier_ledger, suppliers } from "../../db/schema";
import { eq, and, asc, desc, gte, lte, sql } from "drizzle-orm";
import { getTenantContext } from "../../db/context";

export class PostgresSupplierLedgerRepository implements ISupplierLedgerRepository {
  async create(ledgerData: any, tx?: any): Promise<SupplierLedgerEntry> {
    const client = tx || db;
    const { organizationId, currentStoreId } = getTenantContext();

    const [created] = await client
      .insert(supplier_ledger)
      .values({
        organization_id: organizationId,
        store_id: currentStoreId,
        supplier_id: ledgerData.supplier_id,
        transaction_type: ledgerData.transaction_type,
        amount: ledgerData.amount,
        balance: ledgerData.balance,
        reference: ledgerData.reference || null,
      })
      .returning();

    if (!created) {
      throw new Error("Failed to insert supplier ledger record");
    }

    return {
      ...created,
      created_at: created.created_at.toISOString(),
    } as SupplierLedgerEntry;
  }

  async getBySupplierId(
    supplierId: number,
    params?: {
      startDate?: string;
      endDate?: string;
      transaction_type?: string;
    },
    tx?: any
  ): Promise<SupplierLedgerEntry[]> {
    const client = tx || db;
    const { organizationId, currentStoreId } = getTenantContext();
    let cond = and(
      eq(supplier_ledger.supplier_id, supplierId),
      eq(supplier_ledger.organization_id, organizationId),
      eq(supplier_ledger.store_id, currentStoreId)
    );

    if (params?.transaction_type) {
      cond = and(cond, eq(supplier_ledger.transaction_type, params.transaction_type)) as any;
    }

    if (params?.startDate) {
      cond = and(cond, gte(supplier_ledger.created_at, new Date(params.startDate))) as any;
    }

    if (params?.endDate) {
      cond = and(cond, lte(supplier_ledger.created_at, new Date(params.endDate))) as any;
    }

    const rows = await client
      .select()
      .from(supplier_ledger)
      .where(cond)
      .orderBy(desc(supplier_ledger.created_at), desc(supplier_ledger.id));

    return rows.map((r: any) => ({
      ...r,
      amount: Number(r.amount || 0) / 100.0,
      balance: Number(r.balance || 0) / 100.0,
      created_at: r.created_at.toISOString(),
    }));
  }

  async updateByReference(
    reference: string,
    newAmount: number,
    tx?: any
  ): Promise<void> {
    const client = tx || db;
    const { organizationId, currentStoreId } = getTenantContext();
    await client
      .update(supplier_ledger)
      .set({ amount: newAmount })
      .where(and(eq(supplier_ledger.reference, reference), eq(supplier_ledger.organization_id, organizationId), eq(supplier_ledger.store_id, currentStoreId)));
  }

  async recalculateBalances(supplierId: number, tx?: any): Promise<void> {
    const client = tx || db;
    const { organizationId, currentStoreId } = getTenantContext();

    // 1. Fetch all ledger rows in sequential order
    let cond = and(
      eq(supplier_ledger.supplier_id, supplierId),
      eq(supplier_ledger.organization_id, organizationId),
      eq(supplier_ledger.store_id, currentStoreId)
    );

    const rows = await client
      .select()
      .from(supplier_ledger)
      .where(cond)
      .orderBy(asc(supplier_ledger.created_at), asc(supplier_ledger.id));

    // 2. Loop and compute running balance
    let runningBalance = 0;
    for (const row of rows) {
      if (row.transaction_type === "PURCHASE" || row.transaction_type === "PURCHASE_EDIT" || row.transaction_type === "OUTSTANDING_CHANGE") {
        runningBalance += row.amount;
      } else if (row.transaction_type === "PAYMENT" || row.transaction_type === "PURCHASE_CANCEL" || row.transaction_type === "PURCHASE_VOID") {
        runningBalance -= row.amount;
      }

      await client
        .update(supplier_ledger)
        .set({ balance: runningBalance })
        .where(eq(supplier_ledger.id, row.id));
    }

    // 3. Update the final current_balance on the suppliers table
    await client
      .update(suppliers)
      .set({ current_balance: runningBalance })
      .where(and(eq(suppliers.id, supplierId), eq(suppliers.organization_id, organizationId), eq(suppliers.store_id, currentStoreId)));
  }
}
