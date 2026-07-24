import { purchaseV2Service } from "./purchase.v2.service";

export class PurchaseService {
  async generateNextPurchaseNumber(storeId: number, txClient?: any): Promise<string> {
    return purchaseV2Service.generateNextPurchaseNumber(storeId, txClient);
  }

  async create(data: any): Promise<any> {
    return purchaseV2Service.create(data);
  }

  async getAll(params?: { q?: string; startDate?: string; endDate?: string }): Promise<any[]> {
    return purchaseV2Service.getAll(params);
  }

  async getById(id: number): Promise<any> {
    return purchaseV2Service.getById(id);
  }

  async update(id: number, data: any): Promise<any> {
    return purchaseV2Service.update(id, data);
  }

  async delete(id: number): Promise<boolean> {
    return purchaseV2Service.delete(id);
  }
}
