import { customerRepository } from "../repositories";
import { CreateCustomerDTO, UpdateCustomerDTO, Customer } from "../types/customer.types";
import { ValidationError, NotFoundError, ConflictError, ForbiddenError } from "../utils/errors";

export { ValidationError, NotFoundError, ConflictError, ForbiddenError };

export class CustomerService {
  private repository = customerRepository;

  async getAll(): Promise<Customer[]> {
    await this.repository.ensureSystemWalkInCustomer();
    return this.repository.getAll();
  }

  async getById(id: number): Promise<Customer> {
    const customer = await this.repository.getById(id);
    if (!customer) {
      throw new NotFoundError(`Customer with ID ${id} not found`);
    }
    return customer;
  }

  async getByPhone(phone: string): Promise<Customer> {
    const customer = await this.repository.getByPhone(phone);
    if (!customer) {
      throw new NotFoundError(`Customer with phone number "${phone}" not found`);
    }
    return customer;
  }

  async create(dto: CreateCustomerDTO): Promise<Customer> {
    if (dto.name === "Walk-in Customer" || dto.type === "SYSTEM" || dto.is_system === 1) {
      return this.repository.ensureSystemWalkInCustomer();
    }

    if (dto.phone) {
      const existing = await this.repository.getByPhone(dto.phone, true);
      if (existing) {
        if (existing.is_active === 0) {
          const reactivated = await this.repository.update(existing.id, {
            name: dto.name,
            email: dto.email,
            address: dto.address,
            notes: dto.notes,
            is_active: 1,
          });
          if (!reactivated) {
            throw new Error("Failed to reactivate customer");
          }
          try {
            const { SyncQueueManager } = require("./sync.service");
            SyncQueueManager.getInstance().enqueue("customer", reactivated);
          } catch (e) {}
          return reactivated;
        }
        throw new ConflictError(`Phone number "${dto.phone}" already exists`);
      }
    }

    const created = await this.repository.create(dto);
    try {
      const { SyncQueueManager } = require("./sync.service");
      SyncQueueManager.getInstance().enqueue("customer", created);
    } catch (e) {}
    return created;
  }

  async update(id: number, dto: UpdateCustomerDTO): Promise<Customer> {
    const existingCustomer = await this.repository.getById(id);
    if (!existingCustomer) {
      throw new NotFoundError(`Customer with ID ${id} not found`);
    }

    if (existingCustomer.is_protected === 1 || existingCustomer.is_system === 1 || existingCustomer.type === "SYSTEM" || existingCustomer.name === "Walk-in Customer") {
      if (dto.is_active === 0) {
        throw new ForbiddenError("System Walk-in Customer is protected and cannot be disabled or archived.");
      }
      if (dto.name !== undefined && dto.name !== "Walk-in Customer") {
        throw new ForbiddenError("System Walk-in Customer is protected and cannot be renamed.");
      }
    }

    if (dto.phone !== undefined && dto.phone !== existingCustomer.phone && dto.phone) {
      const existingWithPhone = await this.repository.getByPhone(dto.phone);
      if (existingWithPhone) {
        throw new ConflictError(`Phone number "${dto.phone}" already exists`);
      }
    }

    const updatedCustomer = await this.repository.update(id, dto);
    if (!updatedCustomer) {
      throw new NotFoundError(`Customer with ID ${id} not found`);
    }
    try {
      const { SyncQueueManager } = require("./sync.service");
      SyncQueueManager.getInstance().enqueue("customer", updatedCustomer);
    } catch (e) {}
    return updatedCustomer;
  }

  async delete(id: number): Promise<void> {
    const existing = await this.repository.getById(id);
    if (!existing) {
      throw new NotFoundError(`Customer with ID ${id} not found`);
    }
    if (existing.is_protected === 1 || existing.is_system === 1 || existing.type === "SYSTEM" || existing.name === "Walk-in Customer") {
      throw new ForbiddenError("System Walk-in Customer is protected and cannot be deleted.");
    }
    await this.repository.delete(id);
    try {
      const { SyncQueueManager } = require("./sync.service");
      SyncQueueManager.getInstance().enqueue("customer", { ...existing, is_active: 0 });
    } catch (e) {}
  }

  async search(query: string): Promise<Customer[]> {
    return this.repository.search(query);
  }

  async getCustomerInvoices(customerId: number): Promise<any[]> {
    const customer = await this.repository.getById(customerId);
    if (!customer) {
      throw new NotFoundError(`Customer with ID ${customerId} not found`);
    }
    return this.repository.getCustomerInvoices(customerId);
  }
}
