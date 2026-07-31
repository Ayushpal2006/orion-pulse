// Module 2: Enterprise Inventory Engine for Apka Bill V2

export interface ProductBatch {
  id: string;
  productId: number;
  batchNumber: string;
  manufacturingDate?: string;
  expiryDate?: string;
  quantity: number;
  purchasePrice: number;
  supplierId?: number;
}

export interface SerialNumberItem {
  id: string;
  productId: number;
  serialOrImei: string;
  status: "in_stock" | "sold" | "transferred" | "returned";
  saleInvoiceNumber?: string;
}

export interface InventoryAbcCategory {
  productId: number;
  name: string;
  annualValue: number;
  category: "A" | "B" | "C"; // A = Top 70% value, B = Next 20%, C = Bottom 10%
}

export class EnterpriseInventoryService {
  private static instance: EnterpriseInventoryService;
  private batches: ProductBatch[] = [];
  private serials: SerialNumberItem[] = [];

  public static getInstance(): EnterpriseInventoryService {
    if (!EnterpriseInventoryService.instance) {
      EnterpriseInventoryService.instance = new EnterpriseInventoryService();
    }
    return EnterpriseInventoryService.instance;
  }

  addBatch(batch: Omit<ProductBatch, "id">): ProductBatch {
    const newBatch: ProductBatch = {
      ...batch,
      id: `BATCH-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    };
    this.batches.push(newBatch);
    return newBatch;
  }

  getBatchesForProduct(productId: number): ProductBatch[] {
    return this.batches.filter((b) => b.productId === productId && b.quantity > 0);
  }

  getExpiringBatches(daysThreshold: number = 30): ProductBatch[] {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysThreshold);

    return this.batches.filter((b) => {
      if (!b.expiryDate) return false;
      const exp = new Date(b.expiryDate);
      return exp <= targetDate && b.quantity > 0;
    });
  }

  registerSerialOrImei(productId: number, serialOrImei: string): SerialNumberItem {
    const item: SerialNumberItem = {
      id: `SER-${Date.now()}`,
      productId,
      serialOrImei,
      status: "in_stock",
    };
    this.serials.push(item);
    return item;
  }

  calculateAbcAnalysis(products: Array<{ id: number; name: string; stock: number; price: number }>): InventoryAbcCategory[] {
    const calculated = products.map((p) => ({
      productId: p.id,
      name: p.name,
      annualValue: p.stock * p.price,
      category: "C" as "A" | "B" | "C",
    }));

    calculated.sort((a, b) => b.annualValue - a.annualValue);
    const totalValue = calculated.reduce((acc, item) => acc + item.annualValue, 0);

    let cumulative = 0;
    for (const item of calculated) {
      cumulative += item.annualValue;
      const pct = totalValue > 0 ? (cumulative / totalValue) * 100 : 100;
      if (pct <= 70) {
        item.category = "A";
      } else if (pct <= 90) {
        item.category = "B";
      } else {
        item.category = "C";
      }
    }

    return calculated;
  }
}

export const enterpriseInventoryService = EnterpriseInventoryService.getInstance();
