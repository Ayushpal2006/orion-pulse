import { IProductRepository } from "../interfaces/IProductRepository";
import { Product, CreateProductDTO, UpdateProductDTO } from "../../types/product.types";
import { db } from "../../db";
import { products } from "../../db/schema";
import { eq, and, desc, like, or } from "drizzle-orm";
import { getStoreId } from "../../db/context";

export class PostgresProductRepository implements IProductRepository {
  async getAll(tx?: any): Promise<Product[]> {
    const client = tx || db;
    const storeId = getStoreId();
    let cond = eq(products.is_active, 1);
    if (storeId !== undefined) {
      cond = and(cond, eq(products.store_id, storeId)) as any;
    }

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
    const storeId = getStoreId();
    let cond = eq(products.id, id);
    if (storeId !== undefined) {
      cond = and(cond, eq(products.store_id, storeId)) as any;
    }

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
    const storeId = getStoreId();
    let cond = eq(products.sku, sku);
    if (storeId !== undefined) {
      cond = and(cond, eq(products.store_id, storeId)) as any;
    }

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
    const storeId = getStoreId();
    let cond = eq(products.barcode, barcode);
    if (storeId !== undefined) {
      cond = and(cond, eq(products.store_id, storeId)) as any;
    }

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
    const storeId = getStoreId() || 1; // Default to store 1 if undefined

    // Calculate margin and markup based on prices if costing values are not provided
    const purchase = product.purchase_price;
    const selling = product.selling_price;
    let margin = 0;
    let markup = 0;
    if (selling > 0) {
      margin = Math.round(((selling - purchase) / selling) * 100);
      markup = purchase > 0 ? Math.round(((selling - purchase) / purchase) * 100) : 0;
    }

    const [createdProduct] = await client
      .insert(products)
      .values({
        store_id: storeId,
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
        margin_percent: Math.round(margin || 0),
        markup_percent: Math.round(markup || 0),
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
    const storeId = getStoreId();

    const updateData: any = {};
    for (const [key, value] of Object.entries(product)) {
      if (value !== undefined) {
        updateData[key] = value;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return this.getById(id, client);
    }

    // Update margin/markup if purchase/selling prices change
    if (updateData.purchase_price !== undefined || updateData.selling_price !== undefined) {
      const existing = await this.getById(id, client);
      if (existing) {
        const purchase = updateData.purchase_price !== undefined ? updateData.purchase_price : existing.purchase_price;
        const selling = updateData.selling_price !== undefined ? updateData.selling_price : existing.selling_price;
        if (selling > 0) {
          updateData.margin_percent = Math.round(((selling - purchase) / selling) * 100);
          updateData.markup_percent = purchase > 0 ? Math.round(((selling - purchase) / purchase) * 100) : 0;
        }
      }
    }

    updateData.updated_at = new Date();

    let cond = eq(products.id, id);
    if (storeId !== undefined) {
      cond = and(cond, eq(products.store_id, storeId)) as any;
    }

    console.log("🔍 [UPDATE EXECUTING] File: backend/src/repositories/postgres/product.repository.ts:183");
    console.log("   Target Product ID:", id);
    console.log("   Update Object:", JSON.stringify(updateData, null, 2));
    if (updateData.margin_percent !== undefined) {
      console.log("   typeof margin_percent:", typeof updateData.margin_percent, "val:", updateData.margin_percent);
    }
    if (updateData.markup_percent !== undefined) {
      console.log("   typeof markup_percent:", typeof updateData.markup_percent, "val:", updateData.markup_percent);
    }

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
    const storeId = getStoreId();

    let cond = eq(products.id, id);
    if (storeId !== undefined) {
      cond = and(cond, eq(products.store_id, storeId)) as any;
    }

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
    const storeId = getStoreId();
    const likeQuery = `%${query}%`;

    let cond = and(
      eq(products.is_active, 1),
      or(
        like(products.name, likeQuery),
        like(products.sku, likeQuery),
        like(products.barcode, likeQuery)
      )
    );
    if (storeId !== undefined) {
      cond = and(cond, eq(products.store_id, storeId)) as any;
    }

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
    const storeId = getStoreId();

    let cond = eq(products.is_active, 1);
    if (storeId !== undefined) {
      cond = and(cond, eq(products.store_id, storeId)) as any;
    }

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
