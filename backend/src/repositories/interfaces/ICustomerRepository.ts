import { Customer, CreateCustomerDTO, UpdateCustomerDTO } from "../../types/customer.types";

export interface ICustomerRepository {
  getAll(tx?: any): Promise<Customer[]>;
  getById(id: number, tx?: any): Promise<Customer | null>;
  getByPhone(phone: string, includeInactive?: boolean, tx?: any): Promise<Customer | null>;
  create(customer: CreateCustomerDTO, tx?: any): Promise<Customer>;
  update(id: number, customer: UpdateCustomerDTO, tx?: any): Promise<Customer | null>;
  delete(id: number, tx?: any): Promise<boolean>;
  search(query: string, tx?: any): Promise<Customer[]>;
  getCustomerInvoices(customerId: number, tx?: any): Promise<any[]>;
  getCustomersExport(tx?: any): Promise<any[]>;
  ensureSystemWalkInCustomer(orgId?: number, storeId?: number, tx?: any): Promise<Customer>;
}
