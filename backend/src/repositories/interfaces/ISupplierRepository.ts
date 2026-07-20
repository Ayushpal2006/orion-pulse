import { Supplier, CreateSupplierDTO, UpdateSupplierDTO } from "../../types/supplier.types";

export interface ISupplierRepository {
  getAll(params?: { q?: string; sort?: string; includeArchived?: boolean }, tx?: any): Promise<Supplier[]>;
  getById(id: number, tx?: any): Promise<Supplier | null>;
  create(supplier: CreateSupplierDTO, tx?: any): Promise<Supplier>;
  update(id: number, supplier: UpdateSupplierDTO, tx?: any): Promise<Supplier | null>;
  delete(id: number, tx?: any): Promise<boolean>;
  search(query: string, tx?: any): Promise<Supplier[]>;
}
