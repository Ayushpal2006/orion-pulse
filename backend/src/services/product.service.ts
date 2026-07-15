import { productRepository } from "../repositories";
import { CreateProductDTO, UpdateProductDTO, Product } from "../types/product.types";
import { ValidationError, NotFoundError } from "../utils/errors";
import { imageService } from "./image.service";

export { ValidationError, NotFoundError };

export class ProductService {
  private repository = productRepository;

  async getAll(): Promise<Product[]> {
    return this.repository.getAll();
  }

  async getById(id: number): Promise<Product> {
    const product = await this.repository.getById(id);
    if (!product) {
      throw new NotFoundError(`Product with ID ${id} not found`);
    }
    return product;
  }

  async create(dto: CreateProductDTO): Promise<Product> {
    if (dto.selling_price < dto.purchase_price) {
      throw new ValidationError("Selling price cannot be less than purchase price");
    }

    if (dto.stock < 0) {
      throw new ValidationError("Stock cannot be negative");
    }

    const existingSku = await this.repository.getBySku(dto.sku);
    if (existingSku) {
      throw new ValidationError(`Product with SKU "${dto.sku}" already exists`);
    }

    if (dto.barcode) {
      const existingBarcode = await this.repository.getByBarcode(dto.barcode);
      if (existingBarcode) {
        throw new ValidationError(`Product with barcode "${dto.barcode}" already exists`);
      }
    }

    const product = await this.repository.create(dto);
    try {
      const { SyncQueueManager } = require("./sync.service");
      SyncQueueManager.getInstance().enqueue("product", product);
    } catch (e) {}
    return product;
  }

  async update(id: number, dto: UpdateProductDTO): Promise<Product> {
    const existingProduct = await this.repository.getById(id);
    if (!existingProduct) {
      throw new NotFoundError(`Product with ID ${id} not found`);
    }

    const finalPurchasePrice =
      dto.purchase_price !== undefined ? dto.purchase_price : existingProduct.purchase_price;
    const finalSellingPrice =
      dto.selling_price !== undefined ? dto.selling_price : existingProduct.selling_price;

    if (finalSellingPrice < finalPurchasePrice) {
      throw new ValidationError("Selling price cannot be less than purchase price");
    }

    if (dto.stock !== undefined && dto.stock < 0) {
      throw new ValidationError("Stock cannot be negative");
    }

    if (dto.sku !== undefined && dto.sku !== existingProduct.sku) {
      const existingSku = await this.repository.getBySku(dto.sku);
      if (existingSku) {
        throw new ValidationError(`Product with SKU "${dto.sku}" already exists`);
      }
    }

    if (dto.barcode !== undefined && dto.barcode !== null && dto.barcode !== existingProduct.barcode) {
      const existingBarcode = await this.repository.getByBarcode(dto.barcode);
      if (existingBarcode) {
        throw new ValidationError(`Product with barcode "${dto.barcode}" already exists`);
      }
    }

    const updatedProduct = await this.repository.update(id, dto);
    if (!updatedProduct) {
      throw new NotFoundError(`Product with ID ${id} not found during update`);
    }

    try {
      const { SyncQueueManager } = require("./sync.service");
      SyncQueueManager.getInstance().enqueue("product", updatedProduct);
    } catch (e) {}

    return updatedProduct;
  }

  async delete(id: number): Promise<void> {
    const existing = await this.repository.getById(id);
    if (!existing) {
      throw new NotFoundError(`Product with ID ${id} not found`);
    }

    // Delete image from pluggable storage if exists
    if (existing.image_url) {
      try {
        await imageService.delete(existing.image_url);
      } catch (err) {
        console.error("Failed to delete image asset upon product deletion:", err);
      }
    }

    await this.repository.delete(id);
    try {
      const { SyncQueueManager } = require("./sync.service");
      SyncQueueManager.getInstance().enqueue("product", { ...existing, is_active: 0 });
    } catch (e) {}
  }

  async search(query: string): Promise<Product[]> {
    return this.repository.search(query);
  }
}
