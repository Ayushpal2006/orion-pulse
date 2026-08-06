import { IProductRepository } from "../interfaces/IProductRepository";
import { Product, CreateProductDTO, UpdateProductDTO } from "../../types/product.types";
import { db } from "../../db";
import { products } from "../../db/schema";
import { eq, and, desc, like, or, isNull, sql } from "drizzle-orm";
import { getTenantContext } from "../../db/context";
import { inventoryCostService } from "../../services/inventory-cost.service";

function buildTenantCondition(organizationId: number, currentStoreId: number, extraCond?: any) {
  const conditions = [
    eq(products.organization_id, organizationId),
    eq(products.store_id, currentStoreId),
  ];
  if (extraCond) {
    conditions.push(extraCond);
  }
  return and(...conditions);
}

export class PostgresProductRepository implements IProductRepository {
  async getAll(tx?: any): Promise<Product[]> {
    const client = tx || db;
    const { organizationId, currentStoreId } = getTenantContext();
    const cond = buildTenantCondition(organizationId, currentStoreId, eq(products.is_active, 1));

    const rows = await client
      .select()
      .from(products)
      .where(cond)
      .orderBy(desc(products.id));

    return rows.map((r: any) => ({
      ...r,
      created_at: r.created_at.toISOString(),
      updated_at: r.updated_at.toISOString()
    }));
  }

  async getById(id: number, tx?: any): Promise<Product | null> {
    const client = tx || db;
    const { organizationId, currentStoreId } = getTenantContext();
    const cond = buildTenantCondition(organizationId, currentStoreId, eq(products.id, id));

    const rows = await client
      .select()
      .from(products)
      .where(cond)
      .limit(1);

    if (!rows[0]) return null;
    const r = rows[0];
    return {
      ...r,
      created_at: r.created_at.toISOString(),
      updated_at: r.updated_at.toISOString()
    };
  }

  async getBySku(sku: string, tx?: any): Promise<Product | null> {
    const client = tx || db;
    const { organizationId, currentStoreId } = getTenantContext();
    const cond = buildTenantCondition(organizationId, currentStoreId, eq(products.sku, sku));

    const rows = await client
      .select()
      .from(products)
      .where(cond)
      .limit(1);

    if (!rows[0]) return null;
    const r = rows[0];
    return {
      ...r,
      created_at: r.created_at.toISOString(),
      updated_at: r.updated_at.toISOString()
    };
  }

  async getByBarcode(barcode: string, tx?: any): Promise<Product | null> {
    const client = tx || db;
    const { organizationId, currentStoreId } = getTenantContext();
    const cond = buildTenantCondition(organizationId, currentStoreId, eq(products.barcode, barcode));

    const rows = await client
      .select()
      .from(products)
      .where(cond)
      .limit(1);

    if (!rows[0]) return null;
    const r = rows[0];
    return {
      ...r,
      created_at: r.created_at.toISOString(),
      updated_at: r.updated_at.toISOString()
    };
  }

  async create(product: CreateProductDTO, tx?: any): Promise<Product> {
    const client = tx || db;
    const { organizationId, currentStoreId } = getTenantContext();

    // Calculate margin and markup via InventoryCostService single source of truth
    const purchase = product.purchase_price;
    const selling = product.selling_price;
    const margin = inventoryCostService.calculateMarginPercent(selling, purchase);
    const markup = inventoryCostService.calculateMarkupPercent(selling, purchase);

    const [createdProduct] = await client
      .insert(products)
      .values({
        organization_id: organizationId,
        store_id: currentStoreId,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode ?? null,
        category: product.category ?? null,
        purchase_price: product.purchase_price,
        selling_price: product.selling_price,
        stock: product.stock ?? 0,
        minimum_stock: product.minimum_stock ?? 0,
        gst: product.gst ?? 18,
        is_active: product.is_active ?? 1,
        image_url: product.image_url ?? null,
        margin_percent: margin,
        markup_percent: markup,
        average_cost: product.purchase_price,
        last_purchase_cost: product.purchase_price,
        reorder_quantity: product.minimum_stock ? product.minimum_stock * 2 : 10,
      })
      .returning();

    if (!createdProduct) {
      throw new Error("Failed to retrieve created product");
    }

    return {
      ...createdProduct,
      created_at: createdProduct.created_at.toISOString(),
      updated_at: createdProduct.updated_at.toISOString()
    };
  }

  async update(id: number, product: UpdateProductDTO, tx?: any): Promise<Product | null> {
    const client = tx || db;
    const { organizationId, currentStoreId } = getTenantContext();

    const updateData: any = {};
    for (const [key, value] of Object.entries(product)) {
      if (value !== undefined) {
        updateData[key] = value;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return this.getById(id, client);
    }

    // Update margin/markup via InventoryCostService single source of truth if prices change
    if (updateData.purchase_price !== undefined || updateData.selling_price !== undefined) {
      const existing = await this.getById(id, client);
      if (existing) {
        const purchase = updateData.purchase_price !== undefined ? updateData.purchase_price : existing.purchase_price;
        const selling = updateData.selling_price !== undefined ? updateData.selling_price : existing.selling_price;
        const existingAvgCost = (existing as any).average_cost || 0;
        const costBase = existingAvgCost > 0 ? existingAvgCost : purchase;
        updateData.margin_percent = inventoryCostService.calculateMarginPercent(selling, costBase);
        updateData.markup_percent = inventoryCostService.calculateMarkupPercent(selling, costBase);
      }
    }

    updateData.updated_at = new Date();
    const cond = buildTenantCondition(organizationId, currentStoreId, eq(products.id, id));

    const [updatedProduct] = await client
      .update(products)
      .set(updateData)
      .where(cond)
      .returning();

    if (!updatedProduct) return null;

    return {
      ...updatedProduct,
      created_at: updatedProduct.created_at.toISOString(),
      updated_at: updatedProduct.updated_at.toISOString()
    };
  }

  async delete(id: number, tx?: any): Promise<boolean> {
    const client = tx || db;
    const { organizationId, currentStoreId } = getTenantContext();
    const cond = buildTenantCondition(organizationId, currentStoreId, eq(products.id, id));

    const [updatedProduct] = await client
      .update(products)
      .set({
        is_active: 0,
        updated_at: new Date(),
      })
      .where(cond)
      .returning();

    return !!updatedProduct;
  }

  async search(query: string, tx?: any): Promise<Product[]> {
    const client = tx || db;
    const { organizationId, currentStoreId } = getTenantContext();
    const likeQuery = `%${query}%`;

    const searchCond = or(
      like(products.name, likeQuery),
      like(products.sku, likeQuery),
      like(products.barcode, likeQuery)
    );

    const cond = buildTenantCondition(organizationId, currentStoreId, and(eq(products.is_active, 1), searchCond));

    const rows = await client
      .select()
      .from(products)
      .where(cond)
      .orderBy(desc(products.id));

    return rows.map((r: any) => ({
      ...r,
      created_at: r.created_at.toISOString(),
      updated_at: r.updated_at.toISOString()
    }));
  }

  async getProductsExport(tx?: any): Promise<any[]> {
    const client = tx || db;
    const { organizationId, currentStoreId } = getTenantContext();
    const cond = buildTenantCondition(organizationId, currentStoreId, eq(products.is_active, 1));

    const rows = await client
      .select()
      .from(products)
      .where(cond);

    return rows.map((r: any) => ({
      ID: r.id,
      SKU: r.sku,
      Barcode: r.barcode,
      Name: r.name,
      Category: r.category,
      PurchasePrice_INR: r.purchase_price / 100.0,
      SellingPrice_INR: r.selling_price / 100.0,
      Stock: r.stock,
      MinimumStock: r.minimum_stock,
      GST_Percent: r.gst,
    }));
  }
}
