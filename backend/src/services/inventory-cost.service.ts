import { ValidationError } from "../utils/errors";

export interface ProductCostInput {
  id?: number;
  name?: string;
  stock: number;
  average_cost: number; // in Paise
  last_purchase_cost?: number; // in Paise
  selling_price: number; // in Paise
}

export interface PurchaseItemCostInput {
  quantity: number;
  purchase_price: number; // in Paise
  selling_price?: number; // in Paise (optional override)
}

export interface CalculatedInventoryCost {
  average_cost: number; // in Paise
  last_purchase_cost: number; // in Paise
  selling_price: number; // in Paise
  margin_percent: number; // integer %
  markup_percent: number; // integer %
}

export class InventoryCostService {
  /**
   * Primary single source of truth for cost, average_cost, last_purchase_cost,
   * margin_percent, and markup_percent after receiving inventory from a purchase.
   */
  calculateCostAfterPurchase(
    product: ProductCostInput,
    purchaseItem: PurchaseItemCostInput
  ): CalculatedInventoryCost {
    const currentStock = product.stock ?? 0;
    const currentAverageCost = product.average_cost ?? 0;
    const quantityAdded = purchaseItem.quantity;
    const purchasePricePaise = purchaseItem.purchase_price;

    // --- STEP 5 Validation Assertions ---
    if (currentStock < 0) {
      throw new ValidationError(`Invalid product stock: ${currentStock}. Stock must be >= 0.`);
    }
    if (currentAverageCost < 0) {
      throw new ValidationError(`Invalid average cost: ${currentAverageCost}. Average cost must be >= 0.`);
    }
    if (purchasePricePaise <= 0) {
      throw new ValidationError(`Invalid purchase price: ${purchasePricePaise}. Purchase price must be > 0.`);
    }
    if (quantityAdded <= 0) {
      throw new ValidationError(`Invalid quantity added: ${quantityAdded}. Quantity must be > 0.`);
    }

    // Determine selling price (item override if valid, else product default)
    const sellingPricePaise =
      purchaseItem.selling_price !== undefined && purchaseItem.selling_price > 0
        ? purchaseItem.selling_price
        : (product.selling_price ?? 0);

    let finalizedAverageCost: number;

    // --- STEP 3 Edge Cases ---
    if (currentStock === 0) {
      // Case A: New inventory or empty stock
      finalizedAverageCost = purchasePricePaise;
    } else if (currentStock > 0 && currentAverageCost <= 0) {
      // Case B: Existing stock with zero/missing historical cost data
      console.warn(
        `⚠️ [InventoryCostService] Historical inventory detected with zero average cost for product ID ${product.id || "N/A"} (${product.name || "Unknown"}). Defaulting average cost to current purchase price (${purchasePricePaise} Paise).`
      );
      finalizedAverageCost = purchasePricePaise;
    } else {
      // Case C: Normal weighted average costing
      const totalExistingCost = currentStock * currentAverageCost;
      const totalNewCost = quantityAdded * purchasePricePaise;
      const totalStock = currentStock + quantityAdded;
      finalizedAverageCost = Math.round((totalExistingCost + totalNewCost) / totalStock);
    }

    const finalizedLastPurchaseCost = purchasePricePaise;

    // --- STEP 4 Margin & Markup Computation (Post Average Cost Finalization) ---
    const margin_percent = this.calculateMarginPercent(sellingPricePaise, finalizedAverageCost);
    const markup_percent = this.calculateMarkupPercent(sellingPricePaise, finalizedAverageCost);

    return {
      average_cost: finalizedAverageCost,
      last_purchase_cost: finalizedLastPurchaseCost,
      selling_price: sellingPricePaise,
      margin_percent,
      markup_percent,
    };
  }

  /**
   * Helper: Calculate margin percentage from selling price and cost (in Paise)
   */
  calculateMarginPercent(sellingPricePaise: number, costPaise: number): number {
    if (sellingPricePaise <= 0) return 0;
    return Math.round(((sellingPricePaise - costPaise) / sellingPricePaise) * 100);
  }

  /**
   * Helper: Calculate markup percentage from selling price and cost (in Paise)
   */
  calculateMarkupPercent(sellingPricePaise: number, costPaise: number): number {
    if (costPaise <= 0) return 0;
    return Math.round(((sellingPricePaise - costPaise) / costPaise) * 100);
  }
}

export const inventoryCostService = new InventoryCostService();
