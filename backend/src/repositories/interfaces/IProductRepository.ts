import { Product, CreateProductDTO, UpdateProductDTO } from "../../types/product.types";
import { DatabaseAdapter } from "../../database";

export interface IProductRepository {
  getAll(tx?: DatabaseAdapter): Promise<Product[]>;
  getById(id: number, tx?: DatabaseAdapter): Promise<Product | null>;
  getBySku(sku: string, tx?: DatabaseAdapter): Promise<Product | null>;
  getByBarcode(barcode: string, tx?: DatabaseAdapter): Promise<Product | null>;
  create(product: CreateProductDTO, tx?: DatabaseAdapter): Promise<Product>;
  update(id: number, product: UpdateProductDTO, tx?: DatabaseAdapter): Promise<Product | null>;
  delete(id: number, tx?: DatabaseAdapter): Promise<boolean>;
  search(query: string, tx?: DatabaseAdapter): Promise<Product[]>;
  getProductsExport(tx?: DatabaseAdapter): Promise<any[]>;
}
