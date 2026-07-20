import { supplierRepository } from "../repositories";
import { CreateSupplierDTO, UpdateSupplierDTO, Supplier } from "../types/supplier.types";
import { ValidationError, NotFoundError } from "../utils/errors";

export class SupplierService {
  private repository = supplierRepository;

  async getAll(q?: string, sort?: string, includeArchived?: boolean): Promise<Supplier[]> {
    return this.repository.getAll({ q, sort, includeArchived });
  }

  async getById(id: number): Promise<Supplier> {
    const supplier = await this.repository.getById(id);
    if (!supplier) {
      throw new NotFoundError(`Supplier with ID ${id} not found`);
    }
    return supplier;
  }

  async create(dto: CreateSupplierDTO): Promise<Supplier> {
    const created = await this.repository.create(dto);
    try {
      const { SyncQueueManager } = require("./sync.service");
      SyncQueueManager.getInstance().enqueue("supplier", created);
    } catch (e) {
      console.error("Failed to enqueue supplier sync job:", e);
    }
    return created;
  }

  async update(id: number, dto: UpdateSupplierDTO): Promise<Supplier> {
    const existing = await this.repository.getById(id);
    if (!existing) {
      throw new NotFoundError(`Supplier with ID ${id} not found`);
    }

    const updated = await this.repository.update(id, dto);
    if (!updated) {
      throw new NotFoundError(`Supplier with ID ${id} not found`);
    }
    try {
      const { SyncQueueManager } = require("./sync.service");
      SyncQueueManager.getInstance().enqueue("supplier", updated);
    } catch (e) {
      console.error("Failed to enqueue supplier sync job:", e);
    }
    return updated;
  }

  async delete(id: number): Promise<void> {
    const existing = await this.repository.getById(id);
    if (!existing) {
      throw new NotFoundError(`Supplier with ID ${id} not found`);
    }
    await this.repository.delete(id);
    try {
      const { SyncQueueManager } = require("./sync.service");
      SyncQueueManager.getInstance().enqueue("supplier", { ...existing, is_archived: 1 });
    } catch (e) {
      console.error("Failed to enqueue supplier sync job:", e);
    }
  }

  async search(query: string): Promise<Supplier[]> {
    return this.repository.search(query);
  }
}
