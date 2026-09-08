/**
 * Universal pricing utilities for Orion POS / Apka Bill.
 * Ensures consistent canonical mapping across Product, SaleItem, CartItem, and EditableSaleItem.
 */

/**
 * Resolves the canonical selling price of a product or bill item in Rupees (INR).
 *
 * Handles:
 * - Frontend `Product` where `price` is in Rupees (e.g. 350)
 * - Raw backend / SQLite entity where `selling_price` is in integer paise (e.g. 35000)
 * - camelCase `sellingPrice`, `unitPrice`
 * - snake_case `selling_price`, `unit_price`
 * - Intentional zero prices (free / promotional items)
 * - String prices (e.g. "350", "350.00", "0")
 * - Null / undefined / invalid inputs
 *
 * @param prod Any product or bill item object
 * @returns Selling price in Rupees (decimal number >= 0)
 */
export function resolveProductSellingPrice(prod: any): number {
  if (!prod || typeof prod !== "object") {
    return 0;
  }

  // 1. Canonical frontend `price` field (already in Rupees)
  if (prod.price !== undefined && prod.price !== null && prod.price !== "") {
    const val = Number(prod.price);
    if (!isNaN(val) && val >= 0) {
      return val;
    }
  }

  // 2. camelCase `unitPrice` or snake_case `unit_price` (in Rupees)
  const unitPriceCandidate = prod.unitPrice ?? prod.unit_price;
  if (unitPriceCandidate !== undefined && unitPriceCandidate !== null && unitPriceCandidate !== "") {
    const val = Number(unitPriceCandidate);
    if (!isNaN(val) && val >= 0) {
      return val;
    }
  }

  // 3. camelCase `sellingPrice` (in Rupees)
  if (prod.sellingPrice !== undefined && prod.sellingPrice !== null && prod.sellingPrice !== "") {
    const val = Number(prod.sellingPrice);
    if (!isNaN(val) && val >= 0) {
      return val;
    }
  }

  // 4. snake_case `selling_price`
  if (prod.selling_price !== undefined && prod.selling_price !== null && prod.selling_price !== "") {
    const val = Number(prod.selling_price);
    if (!isNaN(val) && val >= 0) {
      // If it has `purchase_price` and NO frontend `price` property,
      // it is a raw unmapped backend or SQLite record where currency is in integer paise.
      if (prod.purchase_price !== undefined && prod.price === undefined) {
        return val / 100;
      }
      return val;
    }
  }

  return 0;
}

/**
 * Resolves the canonical purchase cost of a product in Rupees (INR).
 */
export function resolveProductPurchaseCost(prod: any): number {
  if (!prod || typeof prod !== "object") {
    return 0;
  }

  if (prod.purchase !== undefined && prod.purchase !== null && prod.purchase !== "") {
    const val = Number(prod.purchase);
    if (!isNaN(val) && val >= 0) {
      return val;
    }
  }

  if (prod.purchase_price !== undefined && prod.purchase_price !== null && prod.purchase_price !== "") {
    const val = Number(prod.purchase_price);
    if (!isNaN(val) && val >= 0) {
      if (prod.purchase === undefined && prod.price === undefined) {
        return val / 100;
      }
      return val;
    }
  }

  return 0;
}
