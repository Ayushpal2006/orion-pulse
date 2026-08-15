/**
 * Apka Bill Mobile - Local Sale & Checkout Repository
 *
 * Encapsulates atomic checkout transaction, stock deduction, and offline sale history.
 */

import { getDatabase } from '../database';
import {
  LocalSale,
  LocalSaleItem,
  LocalPayment,
  LocalInventoryMovement,
  LocalProduct,
  CheckoutRequest,
  CheckoutTotals,
} from '../types';

function generateUUID(): string {
  return 'loc-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now().toString(36);
}

export const SaleRepository = {
  /**
   * Executes a complete offline sale checkout in ONE atomic SQLite transaction.
   *
   * Steps executed atomically:
   * 1. Check local product existence & stock availability
   * 2. Decrement local stock for each product
   * 3. Insert sale record (status: COMPLETED, sync_status: PENDING_SYNC)
   * 4. Insert all sale_items
   * 5. Insert payment record
   * 6. Insert inventory_movement audit records
   */
  async createLocalSaleTransaction(
    request: CheckoutRequest,
    totals: CheckoutTotals,
    localInvoiceNumber: string
  ): Promise<{
    sale: LocalSale;
    items: LocalSaleItem[];
    payment: LocalPayment;
    inventoryMovements: LocalInventoryMovement[];
  }> {
    const db = await getDatabase();
    const nowIso = new Date().toISOString();
    const saleLocalId = generateUUID();

    return db.transaction(async (tx) => {
      // 1. Stock Validation & Deduction
      const inventoryMovements: LocalInventoryMovement[] = [];
      const saleItems: LocalSaleItem[] = [];

      for (const cartItem of request.items) {
        const prod = await tx.getFirst<LocalProduct>(
          'SELECT * FROM products WHERE id = ? AND store_id = ? LIMIT 1;',
          [cartItem.product.id, request.storeId]
        );

        if (!prod) {
          throw new Error(`Product "${cartItem.product.name}" (ID: ${cartItem.product.id}) not found in local database.`);
        }

        if (prod.stock < cartItem.quantity) {
          throw new Error(
            `Insufficient stock for "${prod.name}". Available: ${prod.stock}, Requested: ${cartItem.quantity}.`
          );
        }

        const newStock = prod.stock - cartItem.quantity;

        // Atomically update stock
        await tx.executeSql(
          'UPDATE products SET stock = ?, updated_at = ? WHERE id = ?;',
          [newStock, nowIso, prod.id]
        );

        // Record Inventory Movement
        const movId = generateUUID();
        const movement: LocalInventoryMovement = {
          local_id: movId,
          organization_id: request.organizationId || null,
          store_id: request.storeId,
          product_id: prod.id,
          sale_local_id: saleLocalId,
          movement_type: 'SALE',
          quantity: cartItem.quantity,
          previous_stock: prod.stock,
          new_stock: newStock,
          reference_id: localInvoiceNumber,
          created_at: nowIso,
        };
        inventoryMovements.push(movement);

        await tx.executeSql(
          `INSERT INTO inventory_movements (
            local_id, organization_id, store_id, product_id, sale_local_id,
            movement_type, quantity, previous_stock, new_stock, reference_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            movement.local_id,
            movement.organization_id,
            movement.store_id,
            movement.product_id,
            movement.sale_local_id,
            movement.movement_type,
            movement.quantity,
            movement.previous_stock,
            movement.new_stock,
            movement.reference_id,
            movement.created_at,
          ]
        );

        // Prepare Sale Item
        const itemDiscount = cartItem.discount ?? 0;
        const lineSubtotal = cartItem.quantity * prod.selling_price - itemDiscount;
        const lineGst = Math.round((lineSubtotal * (prod.gst ?? 18)) / 100);
        const lineTotal = lineSubtotal + lineGst;

        const saleItem: LocalSaleItem = {
          local_id: generateUUID(),
          sale_local_id: saleLocalId,
          product_id: prod.id,
          product_name: prod.name,
          quantity: cartItem.quantity,
          selling_price: prod.selling_price,
          discount: itemDiscount,
          gst: prod.gst ?? 18,
          line_total: lineTotal,
          created_at: nowIso,
        };
        saleItems.push(saleItem);

        await tx.executeSql(
          `INSERT INTO sale_items (
            local_id, sale_local_id, product_id, product_name,
            quantity, selling_price, discount, gst, line_total, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            saleItem.local_id,
            saleItem.sale_local_id,
            saleItem.product_id,
            saleItem.product_name,
            saleItem.quantity,
            saleItem.selling_price,
            saleItem.discount,
            saleItem.gst,
            saleItem.line_total,
            saleItem.created_at,
          ]
        );
      }

      // 2. Insert Sale Master Record
      const sale: LocalSale = {
        local_id: saleLocalId,
        server_id: null,
        local_invoice_number: localInvoiceNumber,
        invoice_number: null,
        organization_id: request.organizationId || null,
        store_id: request.storeId,
        customer_id: request.customerId || null,
        customer_name: request.customerName || null,
        customer_phone: request.customerPhone || null,
        cashier_name: request.cashierName || 'Cashier',
        payment_method: request.paymentMethod,
        payment_details: null,
        subtotal: totals.subtotal,
        discount: totals.saleDiscount + totals.itemDiscounts,
        gst: totals.totalGst,
        grand_total: totals.grandTotal,
        paid_amount: totals.paidAmount,
        balance: totals.balance,
        status: 'COMPLETED',
        sync_status: 'PENDING_SYNC',
        created_at: nowIso,
        updated_at: nowIso,
      };

      await tx.executeSql(
        `INSERT INTO sales (
          local_id, server_id, local_invoice_number, invoice_number,
          organization_id, store_id, customer_id, customer_name, customer_phone,
          cashier_name, payment_method, payment_details, subtotal, discount,
          gst, grand_total, paid_amount, balance, status, sync_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          sale.local_id,
          sale.server_id,
          sale.local_invoice_number,
          sale.invoice_number,
          sale.organization_id,
          sale.store_id,
          sale.customer_id,
          sale.customer_name,
          sale.customer_phone,
          sale.cashier_name,
          sale.payment_method,
          sale.payment_details,
          sale.subtotal,
          sale.discount,
          sale.gst,
          sale.grand_total,
          sale.paid_amount,
          sale.balance,
          sale.status,
          sale.sync_status,
          sale.created_at,
          sale.updated_at,
        ]
      );

      // 3. Insert Payment Record
      const payment: LocalPayment = {
        local_id: generateUUID(),
        sale_local_id: saleLocalId,
        payment_method: request.paymentMethod,
        amount: totals.paidAmount,
        reference: request.paymentReference || null,
        status: 'COMPLETED',
        created_at: nowIso,
      };

      await tx.executeSql(
        `INSERT INTO payments (
          local_id, sale_local_id, payment_method, amount, reference, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [
          payment.local_id,
          payment.sale_local_id,
          payment.payment_method,
          payment.amount,
          payment.reference,
          payment.status,
          payment.created_at,
        ]
      );

      // 4. Atomically Enqueue into sync_queue
      const queueId = generateUUID();
      const idempotencyKey = `${request.storeId}-${saleLocalId}`;
      const payloadObj = {
        offlineIdentifier: saleLocalId,
        offlineInvoiceNumber: localInvoiceNumber,
        storeId: request.storeId,
        organizationId: request.organizationId,
        customerId: request.customerId,
        customerName: request.customerName,
        customerPhone: request.customerPhone,
        cashierName: request.cashierName,
        paymentMethod: request.paymentMethod,
        subtotal: totals.subtotal,
        discount: totals.saleDiscount + totals.itemDiscounts,
        gst: totals.totalGst,
        grandTotal: totals.grandTotal,
        paidAmount: totals.paidAmount,
        balance: totals.balance,
        items: request.items.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
          sellingPrice: i.product.selling_price,
          discount: i.discount ?? 0,
          lineTotal: (i.quantity * i.product.selling_price) - (i.discount ?? 0),
        })),
        createdAt: nowIso,
      };

      await tx.executeSql(
        `INSERT INTO sync_queue (
          id, entity_type, entity_local_id, operation, idempotency_key,
          payload, status, attempts, next_attempt_at, last_error, created_at, updated_at
        ) VALUES (?, 'SALE', ?, 'CREATE', ?, ?, 'PENDING', 0, ?, NULL, ?, ?);`,
        [
          queueId,
          saleLocalId,
          idempotencyKey,
          JSON.stringify(payloadObj),
          nowIso,
          nowIso,
          nowIso,
        ]
      );

      return {
        sale,
        items: saleItems,
        payment,
        inventoryMovements,
      };
    });
  },

  /**
   * Retrieves all local sales with optional store filter
   */
  async getAllSales(storeId?: number, limit = 50): Promise<LocalSale[]> {
    const db = await getDatabase();
    let sql = 'SELECT * FROM sales WHERE 1=1';
    const params: any[] = [];

    if (storeId !== undefined) {
      sql += ' AND store_id = ?';
      params.push(storeId);
    }

    sql += ' ORDER BY created_at DESC LIMIT ?;';
    params.push(limit);

    return db.getAll<LocalSale>(sql, params);
  },

  /**
   * Retrieves a sale by local identifier with all associated items and payments
   */
  async getSaleByLocalId(localId: string): Promise<{
    sale: LocalSale | null;
    items: LocalSaleItem[];
    payment: LocalPayment | null;
    inventoryMovements: LocalInventoryMovement[];
  }> {
    const db = await getDatabase();
    const sale = await db.getFirst<LocalSale>('SELECT * FROM sales WHERE local_id = ? LIMIT 1;', [localId]);
    if (!sale) {
      return { sale: null, items: [], payment: null, inventoryMovements: [] };
    }

    const [items, payment, movements] = await Promise.all([
      db.getAll<LocalSaleItem>('SELECT * FROM sale_items WHERE sale_local_id = ?;', [localId]),
      db.getFirst<LocalPayment>('SELECT * FROM payments WHERE sale_local_id = ? LIMIT 1;', [localId]),
      db.getAll<LocalInventoryMovement>('SELECT * FROM inventory_movements WHERE sale_local_id = ?;', [localId]),
    ]);

    return { sale, items, payment, inventoryMovements: movements };
  },

  /**
   * Returns count of local sales
   */
  async count(storeId?: number): Promise<number> {
    const db = await getDatabase();
    let sql = 'SELECT COUNT(*) as count FROM sales';
    const params: any[] = [];
    if (storeId !== undefined) {
      sql += ' WHERE store_id = ?';
      params.push(storeId);
    }
    const row = await db.getFirst<{ count: number }>(sql, params);
    return row ? Number(row.count) : 0;
  },

  /**
   * Returns sales pending synchronization
   */
  async getPendingSync(storeId?: number): Promise<LocalSale[]> {
    const db = await getDatabase();
    let sql = "SELECT * FROM sales WHERE sync_status = 'PENDING_SYNC'";
    const params: any[] = [];
    if (storeId !== undefined) {
      sql += ' AND store_id = ?';
      params.push(storeId);
    }
    sql += ' ORDER BY created_at ASC;';
    return db.getAll<LocalSale>(sql, params);
  },
};

export default SaleRepository;
