/**
 * Apka Bill Mobile - Local-First Offline Billing Service
 *
 * Responsibilities:
 * - Deterministic pricing, GST, discount, and grand total calculations
 * - Local cart and stock availability validation
 * - Unique collision-safe offline invoice number generation
 * - Atomic execution of local checkout transactions in SQLite
 * - Ensures NO network requests are made during offline checkout
 */

import {
  CartItem,
  CheckoutRequest,
  CheckoutResult,
  CheckoutTotals,
  LocalProduct,
} from '../db/types';
import { SaleRepository, ProductRepository, SettingsRepository } from '../db/repositories';

let localSequenceCounter = 1;

export const LocalBillingService = {
  /**
   * Calculates deterministic pricing breakdown according to existing business rules
   */
  calculateTotals(items: CartItem[], saleDiscount = 0, paidAmount?: number): CheckoutTotals {
    let subtotal = 0;
    let itemDiscounts = 0;
    let totalGst = 0;

    for (const item of items) {
      const lineSubtotal = item.quantity * item.product.selling_price;
      const discount = item.discount ?? 0;
      const taxableAmount = Math.max(0, lineSubtotal - discount);
      const gstRate = item.product.gst !== undefined ? item.product.gst : 18;
      const lineGst = Math.round((taxableAmount * gstRate) / 100);

      subtotal += lineSubtotal;
      itemDiscounts += discount;
      totalGst += lineGst;
    }

    const totalDiscount = itemDiscounts + saleDiscount;
    const grandTotal = Math.max(0, subtotal + totalGst - totalDiscount);
    const finalPaid = paidAmount !== undefined ? paidAmount : grandTotal;
    const balance = Math.max(0, grandTotal - finalPaid);

    return {
      subtotal,
      itemDiscounts,
      totalGst,
      saleDiscount,
      grandTotal,
      paidAmount: finalPaid,
      balance,
    };
  },

  /**
   * Validates cart items
   */
  validateCart(items: CartItem[]): void {
    if (!items || items.length === 0) {
      throw new Error('Cart is empty. Please add at least one product.');
    }

    for (const item of items) {
      if (!item.product || !item.product.id) {
        throw new Error('Invalid product in cart.');
      }
      if (!item.quantity || item.quantity <= 0) {
        throw new Error(`Invalid quantity for "${item.product.name}". Must be at least 1.`);
      }
    }
  },

  /**
   * Validates that local SQLite stock is sufficient for all cart items
   */
  async validateStock(items: CartItem[], storeId: number): Promise<void> {
    for (const item of items) {
      const prod = await ProductRepository.getById(item.product.id);
      if (!prod) {
        throw new Error(`Product "${item.product.name}" not found in local catalog.`);
      }
      if (prod.stock < item.quantity) {
        throw new Error(
          `Insufficient stock for "${prod.name}". Available: ${prod.stock}, Requested: ${item.quantity}.`
        );
      }
    }
  },

  /**
   * Generates a collision-resistant offline invoice number
   * Format: INV-OFFLINE-{storeId}-{YYYYMMDD}-{random4}-{seq}
   */
  generateLocalInvoiceNumber(storeId: number): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;
    const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
    const seq = String(localSequenceCounter++).padStart(4, '0');

    return `INV-OFFLINE-${storeId}-${dateStr}-${randomHex}-${seq}`;
  },

  /**
   * Executes a complete offline sale checkout atomically in SQLite
   */
  async checkout(request: CheckoutRequest): Promise<CheckoutResult> {
    try {
      // 1. Validate Cart Structure
      this.validateCart(request.items);

      // 2. Validate Local Stock
      await this.validateStock(request.items, request.storeId);

      // 3. Compute Deterministic Totals
      const totals = this.calculateTotals(
        request.items,
        request.discount ?? 0,
        request.paidAmount
      );

      // 4. Generate Unique Local Invoice Number
      const localInvoiceNumber = this.generateLocalInvoiceNumber(request.storeId);

      console.log(`[LocalBillingService] Creating offline sale "${localInvoiceNumber}" (Total: ₹${totals.grandTotal / 100})...`);

      // 5. Execute Atomic SQLite Transaction
      const { sale, items, payment } = await SaleRepository.createLocalSaleTransaction(
        request,
        totals,
        localInvoiceNumber
      );

      console.log(`[LocalBillingService] ✅ Offline sale committed atomically (Local ID: ${sale.local_id}, Status: ${sale.sync_status}).`);

      return {
        success: true,
        sale,
        items,
        payment,
        totals,
      };
    } catch (err: any) {
      console.error('[LocalBillingService] ❌ Checkout rejected:', err.message);
      return {
        success: false,
        error: err.message || 'Offline checkout failed.',
      };
    }
  },
};

export default LocalBillingService;
