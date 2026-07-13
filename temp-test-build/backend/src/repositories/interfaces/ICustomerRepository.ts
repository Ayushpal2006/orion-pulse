import { Customer, CreateCustomerDTO, UpdateCustomerDTO } from "../../types/customer.types";
import { DatabaseAdapter } from "../../database";

export interface ICustomerRepository {
  getAll(tx?: DatabaseAdapter): Promise<Customer[]>;
  getById(id: number, tx?: DatabaseAdapter): Promise<Customer | null>;
  getByPhone(phone: string, includeInactive?: boolean, tx?: DatabaseAdapter): Promise<Customer | null>;
  create(customer: CreateCustomerDTO, tx?: DatabaseAdapter): Promise<Customer>;
  update(id: number, customer: UpdateCustomerDTO, tx?: DatabaseAdapter): Promise<Customer | null>;
  delete(id: number, tx?: DatabaseAdapter): Promise<boolean>;
  search(query: string, tx?: DatabaseAdapter): Promise<Customer[]>;
  getCustomerInvoices(customerId: number, tx?: DatabaseAdapter): Promise<any[]>;
  getCustomersExport(tx?: DatabaseAdapter): Promise<any[]>;
}
