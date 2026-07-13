import { IProductRepository } from "../interfaces/IProductRepository";
import { Product, CreateProductDTO, UpdateProductDTO } from "../../types/product.types";
import { DatabaseAdapter } from "../../database";
import dbProxy from "../../database";

export class PostgresProductRepository implements IProductRepository {
  constructor(private db: DatabaseAdapter = dbProxy) {}

  async getAll(tx?: DatabaseAdapter): Promise<Product[]> {
    const client = tx || this.db;
    return client.query<Product>("SELECT * FROM products WHERE is_active = 1 ORDER BY id DESC");
  }

  async getById(id: number, tx?: DatabaseAdapter): Promise<Product | null> {
    const client = tx || this.db;
    return client.queryOne<Product>("SELECT * FROM products WHERE id = ?", [id]);
  }

  async getBySku(sku: string, tx?: DatabaseAdapter): Promise<Product | null> {
    const client = tx || this.db;
    return client.queryOne<Product>("SELECT * FROM products WHERE sku = ?", [sku]);
  }

  async getByBarcode(barcode: string, tx?: DatabaseAdapter): Promise<Product | null> {
    const client = tx || this.db;
    return client.queryOne<Product>("SELECT * FROM products WHERE barcode = ?", [barcode]);
  }

  async create(product: CreateProductDTO, tx?: DatabaseAdapter): Promise<Product> {
    const client = tx || this.db;
    const result = await client.execute(`
      INSERT INTO products (
        name, sku, barcode, category, purchase_price, selling_price, stock, minimum_stock, gst, image_url
      ) VALUES (
        @name, @sku, @barcode, @category, @purchase_price, @selling_price, @stock, @minimum_stock, @gst, @image_url
      )
    `, {
      name: product.name,
      sku: product.sku,
      barcode: product.barcode ?? null,
      category: product.category ?? null,
      purchase_price: product.purchase_price,
      selling_price: product.selling_price,
      stock: product.stock ?? 0,
      minimum_stock: product.minimum_stock ?? 0,
      gst: product.gst ?? 18,
      image_url: product.image_url ?? null,
    });

    const newId = Number(result.lastInsertId);
    const createdProduct = await this.getById(newId, client);
    if (!createdProduct) {
      throw new Error("Failed to retrieve created product");
    }
    return createdProduct;
  }

  async update(id: number, product: UpdateProductDTO, tx?: DatabaseAdapter): Promise<Product | null> {
    const client = tx || this.db;
    const fields = (Object.keys(product) as Array<keyof UpdateProductDTO>).filter(
      (key) => product[key] !== undefined
    );

    if (fields.length === 0) {
      return this.getById(id, client);
    }

    const setClauses = fields.map((field) => `${field} = @${field}`);
    setClauses.push("updated_at = CURRENT_TIMESTAMP");

    const query = `UPDATE products SET ${setClauses.join(", ")} WHERE id = @id`;
    const params: any = { id };
    for (const field of fields) {
      params[field] = product[field] ?? null;
    }

    const result = await client.execute(query, params);
    if (result.changes === 0) {
      return null;
    }

    return this.getById(id, client);
  }

  async delete(id: number, tx?: DatabaseAdapter): Promise<boolean> {
    const client = tx || this.db;
    const result = await client.execute("UPDATE products SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [id]);
    return result.changes > 0;
  }

  async search(query: string, tx?: DatabaseAdapter): Promise<Product[]> {
    const client = tx || this.db;
    const likeQuery = `%${query}%`;
    return client.query<Product>(`
      SELECT * FROM products 
      WHERE is_active = 1 
        AND (name LIKE ? 
          OR sku LIKE ? 
          OR barcode LIKE ?)
      ORDER BY id DESC
    `, [likeQuery, likeQuery, likeQuery]);
  }

  async getProductsExport(tx?: DatabaseAdapter): Promise<any[]> {
    const client = tx || this.db;
    return client.query(`
      SELECT id as ID, 
             sku as SKU, 
             barcode as Barcode, 
             name as Name, 
             category as Category, 
             purchase_price/100.0 as PurchasePrice_INR, 
             selling_price/100.0 as SellingPrice_INR, 
             stock as Stock, 
             minimum_stock as MinimumStock, 
             gst as GST_Percent 
      FROM products 
      WHERE is_active = 1
    `);
  }
}
