import { IPurchaseRepository } from "../interfaces/IPurchaseRepository";
import { PurchaseOrder, PurchaseItem } from "../../types/purchase.types";
import { purchaseV2Repository } from "./purchase.v2.repository";

export class PostgresPurchaseRepository implements IPurchaseRepository {
  async create(poData: any, itemsData: any[], tx?: any): Promise<PurchaseOrder> {
    return purchaseV2Repository.create(poData, itemsData, tx);
  }

  async getAll(params?: { q?: string; startDate?: string; endDate?: string }, tx?: any): Promise<PurchaseOrder[]> {
    return purchaseV2Repository.getAll(params, tx);
  }

  async getById(id: number, tx?: any): Promise<PurchaseOrder | null> {
    return purchaseV2Repository.getById(id, tx);
  }

  async getItems(purchaseOrderId: number, tx?: any): Promise<PurchaseItem[]> {
    return purchaseV2Repository.getItems(purchaseOrderId, tx);
  }

  async update(id: number, poData: any, tx?: any): Promise<PurchaseOrder | null> {
    return purchaseV2Repository.update(id, poData, tx);
  }

  async delete(id: number, tx?: any): Promise<boolean> {
    return purchaseV2Repository.delete(id, tx);
  }

  async deleteItems(purchaseOrderId: number, tx?: any): Promise<void> {
    return purchaseV2Repository.deleteItems(purchaseOrderId, tx);
  }

  async insertItems(items: any[], tx?: any): Promise<void> {
    return purchaseV2Repository.insertItems(items, tx);
  }
}
