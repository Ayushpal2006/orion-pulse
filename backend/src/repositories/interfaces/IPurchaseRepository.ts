import { PurchaseOrder, PurchaseItem } from "../../types/purchase.types";

export interface IPurchaseRepository {
  create(poData: any, itemsData: any[], tx?: any): Promise<PurchaseOrder>;
  getAll(params?: { q?: string; startDate?: string; endDate?: string }, tx?: any): Promise<PurchaseOrder[]>;
  getById(id: number, tx?: any): Promise<PurchaseOrder | null>;
  getItems(purchaseOrderId: number, tx?: any): Promise<PurchaseItem[]>;
  update(id: number, poData: any, tx?: any): Promise<PurchaseOrder | null>;
  delete(id: number, tx?: any): Promise<boolean>;
  deleteItems(purchaseOrderId: number, tx?: any): Promise<void>;
  insertItems(items: any[], tx?: any): Promise<void>;
}
