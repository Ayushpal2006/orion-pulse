import db from "../database/db";
import { Product, CreateProductDTO, UpdateProductDTO } from "../types/product.types";

export class ProductRepository {
  getAll(): Product[] {
    const stmt = db.prepare("SELECT * FROM products WHERE is_active = 1 ORDER BY id DESC");
    return stmt.all() as Product[];
  }

  getById(id: number): Product | null {
    const stmt = db.prepare("SELECT * FROM products WHERE id = ?");
    const result = stmt.get(id);
    return (result as Product) || null;
  }

  getBySku(sku: string): Product | null {
    const stmt = db.prepare("SELECT * FROM products WHERE sku = ?");
    const result = stmt.get(sku);
    return (result as Product) || null;
  }

  getByBarcode(barcode: string): Product | null {
    const stmt = db.prepare("SELECT * FROM products WHERE barcode = ?");
    const result = stmt.get(barcode);
    return (result as Product) || null;
  }

  create(product: CreateProductDTO): Product {
    const stmt = db.prepare(`
      INSERT INTO products (
        name, sku, barcode, category, purchase_price, selling_price, stock, minimum_stock, gst
      ) VALUES (
        @name, @sku, @barcode, @category, @purchase_price, @selling_price, @stock, @minimum_stock, @gst
      )
    `);

    const result = stmt.run({
      name: product.name,
      sku: product.sku,
      barcode: product.barcode ?? null,
      category: product.category ?? null,
      purchase_price: product.purchase_price,
      selling_price: product.selling_price,
      stock: product.stock ?? 0,
      minimum_stock: product.minimum_stock ?? 0,
      gst: product.gst ?? 18,
    });

    const newId = Number(result.lastInsertRowid);
    const createdProduct = this.getById(newId);
    if (!createdProduct) {
      throw new Error("Failed to retrieve created product");
    }
    return createdProduct;
  }

  update(id: number, product: UpdateProductDTO): Product | null {
    const fields = (Object.keys(product) as Array<keyof UpdateProductDTO>).filter(
      (key) => product[key] !== undefined
    );

    if (fields.length === 0) {
      return this.getById(id);
    }

    const setClauses = fields.map((field) => `${field} = @${field}`);
    setClauses.push("updated_at = CURRENT_TIMESTAMP");

    const query = `UPDATE products SET ${setClauses.join(", ")} WHERE id = @id`;
    const stmt = db.prepare(query);

    const params: any = { id };
    for (const field of fields) {
      params[field] = product[field] ?? null;
    }

    const result = stmt.run(params);
    if (result.changes === 0) {
      return null;
    }

    return this.getById(id);
  }

  delete(id: number): boolean {
    const stmt = db.prepare("UPDATE products SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
    const result = stmt.run(id);
    return result.changes > 0;
  }

  search(query: string): Product[] {
    const likeQuery = `%${query}%`;
    const stmt = db.prepare(`
      SELECT * FROM products 
      WHERE is_active = 1 
        AND (name LIKE ? 
          OR sku LIKE ? 
          OR barcode LIKE ?)
      ORDER BY id DESC
    `);
    return stmt.all(likeQuery, likeQuery, likeQuery) as Product[];
  }
}
