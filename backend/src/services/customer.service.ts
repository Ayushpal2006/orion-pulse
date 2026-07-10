import { CustomerRepository } from "../repositories/customer.repository";
import { CreateCustomerDTO, UpdateCustomerDTO, Customer } from "../types/customer.types";
import { ValidationError, NotFoundError } from "./product.service";

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class CustomerService {
  private repository: CustomerRepository;

  constructor() {
    this.repository = new CustomerRepository();
  }

  async getAll(): Promise<Customer[]> {
    return this.repository.getAll();
  }

  async getById(id: number): Promise<Customer> {
    const customer = this.repository.getById(id);
    if (!customer) {
      throw new NotFoundError(`Customer with ID ${id} not found`);
    }
    return customer;
  }

  async getByPhone(phone: string): Promise<Customer> {
    const customer = this.repository.getByPhone(phone);
    if (!customer) {
      throw new NotFoundError(`Customer with phone number "${phone}" not found`);
    }
    return customer;
  }

  async create(dto: CreateCustomerDTO): Promise<Customer> {
    // 1. Validate phone number uniqueness or reactivate if soft-deleted.
    const existing = this.repository.getByPhone(dto.phone, true);
    if (existing) {
      if (existing.is_active === 0) {
        const reactivated = this.repository.update(existing.id, {
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

    const created = this.repository.create(dto);
    try {
      const { SyncQueueManager } = require("./sync.service");
      SyncQueueManager.getInstance().enqueue("customer", created);
    } catch (e) {}
    return created;
  }

  async update(id: number, dto: UpdateCustomerDTO): Promise<Customer> {
    const existingCustomer = this.repository.getById(id);
    if (!existingCustomer) {
      throw new NotFoundError(`Customer with ID ${id} not found`);
    }

    // 2. Validate phone number uniqueness if it is changing
    if (dto.phone !== undefined && dto.phone !== existingCustomer.phone) {
      const existingWithPhone = this.repository.getByPhone(dto.phone);
      if (existingWithPhone) {
        throw new ConflictError(`Phone number "${dto.phone}" already exists`);
      }
    }

    const updatedCustomer = this.repository.update(id, dto);
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
    const existing = this.repository.getById(id);
    if (!existing) {
      throw new NotFoundError(`Customer with ID ${id} not found`);
    }
    this.repository.delete(id);
    try {
      const { SyncQueueManager } = require("./sync.service");
      SyncQueueManager.getInstance().enqueue("customer", { ...existing, is_active: 0 });
    } catch (e) {}
  }

  async search(query: string): Promise<Customer[]> {
    return this.repository.search(query);
  }

  async getCustomerInvoices(customerId: number): Promise<any[]> {
    const customer = this.repository.getById(customerId);
    if (!customer) {
      throw new NotFoundError(`Customer with ID ${customerId} not found`);
    }
    return this.repository.getCustomerInvoices(customerId);
  }
}
