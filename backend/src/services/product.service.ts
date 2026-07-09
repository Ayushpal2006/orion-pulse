import { ProductRepository } from "../repositories/product.repository";
import { CreateProductDTO, UpdateProductDTO, Product } from "../types/product.types";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ProductService {
  private repository: ProductRepository;

  constructor() {
    this.repository = new ProductRepository();
  }

  async getAll(): Promise<Product[]> {
    return this.repository.getAll();
  }

  async getById(id: number): Promise<Product> {
    const product = this.repository.getById(id);
    if (!product) {
      throw new NotFoundError(`Product with ID ${id} not found`);
    }
    return product;
  }

  async create(dto: CreateProductDTO): Promise<Product> {
    // 1. Selling price >= purchase price
    if (dto.selling_price < dto.purchase_price) {
      throw new ValidationError("Selling price cannot be less than purchase price");
    }

    // 2. Stock >= 0
    if (dto.stock < 0) {
      throw new ValidationError("Stock cannot be negative");
    }

    // 3. SKU unique
    const existingSku = this.repository.getBySku(dto.sku);
    if (existingSku) {
      throw new ValidationError(`Product with SKU "${dto.sku}" already exists`);
    }

    // 4. Barcode unique (if provided)
    if (dto.barcode) {
      const existingBarcode = this.repository.getByBarcode(dto.barcode);
      if (existingBarcode) {
        throw new ValidationError(`Product with barcode "${dto.barcode}" already exists`);
      }
    }

    return this.repository.create(dto);
  }

  async update(id: number, dto: UpdateProductDTO): Promise<Product> {
    const existingProduct = this.repository.getById(id);
    if (!existingProduct) {
      throw new NotFoundError(`Product with ID ${id} not found`);
    }

    // Verify selling price vs purchase price if either is updated
    const finalPurchasePrice =
      dto.purchase_price !== undefined ? dto.purchase_price : existingProduct.purchase_price;
    const finalSellingPrice =
      dto.selling_price !== undefined ? dto.selling_price : existingProduct.selling_price;

    if (finalSellingPrice < finalPurchasePrice) {
      throw new ValidationError("Selling price cannot be less than purchase price");
    }

    // Verify stock >= 0 if updated
    if (dto.stock !== undefined && dto.stock < 0) {
      throw new ValidationError("Stock cannot be negative");
    }

    // Verify SKU unique if updated
    if (dto.sku !== undefined && dto.sku !== existingProduct.sku) {
      const existingSku = this.repository.getBySku(dto.sku);
      if (existingSku) {
        throw new ValidationError(`Product with SKU "${dto.sku}" already exists`);
      }
    }

    // Verify Barcode unique if updated
    if (dto.barcode !== undefined && dto.barcode !== null && dto.barcode !== existingProduct.barcode) {
      const existingBarcode = this.repository.getByBarcode(dto.barcode);
      if (existingBarcode) {
        throw new ValidationError(`Product with barcode "${dto.barcode}" already exists`);
      }
    }

    const updatedProduct = this.repository.update(id, dto);
    if (!updatedProduct) {
      throw new NotFoundError(`Product with ID ${id} not found`);
    }
    return updatedProduct;
  }

  async delete(id: number): Promise<void> {
    const existing = this.repository.getById(id);
    if (!existing) {
      throw new NotFoundError(`Product with ID ${id} not found`);
    }
    this.repository.delete(id);
  }

  async search(query: string): Promise<Product[]> {
    return this.repository.search(query);
  }
}
