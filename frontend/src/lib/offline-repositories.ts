// Repositories Layer for Apka Bill V2 Offline-First Architecture

import {
  getProductsOffline,
  saveProductsOffline,
  getCustomersOffline,
  saveCustomersOffline,
  queueOfflineSale,
  getPendingSalesOffline,
  OfflineProduct,
  OfflineCustomer,
  OfflinePendingSale,
} from "./offline-db";

export class ProductRepository {
  private static instance: ProductRepository;

  public static getInstance(): ProductRepository {
    if (!ProductRepository.instance) {
      ProductRepository.instance = new ProductRepository();
    }
    return ProductRepository.instance;
  }

  async searchLocalProducts(query: string): Promise<OfflineProduct[]> {
    const startTime = performance.now();
    const products = await getProductsOffline();
    if (!query.trim()) {
      console.log(`[ProductRepository] Search empty query returned ${products.length} products in ${(performance.now() - startTime).toFixed(2)} ms`);
      return products;
    }

    const q = query.toLowerCase().trim();
    const filtered = products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q))
    );

    console.log(`[ProductRepository] Local search for "${query}" matched ${filtered.length} products in ${(performance.now() - startTime).toFixed(2)} ms`);
    return filtered;
  }

  async findByBarcode(barcode: string): Promise<OfflineProduct | null> {
    const startTime = performance.now();
    const products = await getProductsOffline();
    const match = products.find((p) => p.barcode === barcode || p.sku === barcode) || null;
    console.log(`[ProductRepository] Barcode search for "${barcode}" completed in ${(performance.now() - startTime).toFixed(2)} ms`);
    return match;
  }

  async updateLocalStock(productId: number | string, deltaQty: number): Promise<void> {
    const products = await getProductsOffline();
    const prod = products.find((p) => String(p.id) === String(productId));
    if (prod) {
      prod.stock = Math.max(0, prod.stock - deltaQty);
      await saveProductsOffline(products);
    }
  }
}

export class CustomerRepository {
  private static instance: CustomerRepository;

  public static getInstance(): CustomerRepository {
    if (!CustomerRepository.instance) {
      CustomerRepository.instance = new CustomerRepository();
    }
    return CustomerRepository.instance;
  }

  async searchLocalCustomers(query: string): Promise<OfflineCustomer[]> {
    const customers = await getCustomersOffline();
    if (!query.trim()) return customers;

    const q = query.toLowerCase().trim();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q))
    );
  }
}

export class SaleRepository {
  private static instance: SaleRepository;

  public static getInstance(): SaleRepository {
    if (!SaleRepository.instance) {
      SaleRepository.instance = new SaleRepository();
    }
    return SaleRepository.instance;
  }

  async createOfflineSale(salePayload: Omit<OfflinePendingSale, "syncStatus">): Promise<OfflinePendingSale> {
    const fullPayload: OfflinePendingSale = {
      ...salePayload,
      syncStatus: "pending",
    };
    await queueOfflineSale(fullPayload);
    console.log(`[SaleRepository] Enqueued offline sale ${fullPayload.invoice_number} (OfflineId: ${fullPayload.offlineId})`);
    return fullPayload;
  }

  async getPendingQueue(): Promise<OfflinePendingSale[]> {
    return getPendingSalesOffline();
  }
}

export const productRepo = ProductRepository.getInstance();
export const customerRepo = CustomerRepository.getInstance();
export const saleRepo = SaleRepository.getInstance();
