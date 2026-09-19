import { kotRepository } from "../repositories";
import { KotDTO, CreateKotInput } from "../types/kot.types";
import { getStoreId, getOrganizationId } from "../db/context";
import { NotFoundError, ValidationError } from "../utils/errors";
import { logger } from "../logger/logger";

export class KotService {
  private kotRepo = kotRepository;

  async getById(id: number): Promise<KotDTO> {
    const storeId = getStoreId() || 1;
    const orgId = getOrganizationId() || 1;

    const kot = await this.kotRepo.getById(id, storeId, orgId);
    if (!kot) {
      throw new NotFoundError(`KOT with ID #${id} not found for store #${storeId}`);
    }
    return kot;
  }

  async getBySaleId(saleId: number): Promise<KotDTO[]> {
    const storeId = getStoreId() || 1;
    const orgId = getOrganizationId() || 1;

    return await this.kotRepo.getBySaleId(saleId, storeId, orgId);
  }

  async getAll(params: { status?: string; limit?: number; offset?: number }): Promise<KotDTO[]> {
    const storeId = getStoreId() || 1;
    const orgId = getOrganizationId() || 1;

    return await this.kotRepo.getAll({
      storeId,
      orgId,
      status: params.status,
      limit: params.limit,
      offset: params.offset,
    });
  }

  async createKotForSale(
    saleId: number,
    items: { productId: number; productName: string; quantity: number; notes?: string }[],
    options?: { tableNo?: string; orderType?: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'; notes?: string },
    txClient?: any
  ): Promise<KotDTO | null> {
    if (!items || items.length === 0) {
      return null;
    }

    const storeId = getStoreId() || 1;
    const orgId = getOrganizationId() || 1;

    const input: CreateKotInput = {
      saleId,
      tableNo: options?.tableNo,
      orderType: options?.orderType || 'DINE_IN',
      notes: options?.notes,
      items,
    };

    const created = await this.kotRepo.createKot(orgId, storeId, input, txClient);
    logger.info(`[KotService] Generated KOT #${created.kotNumber} for Sale #${saleId} (Items: ${items.length})`);
    return created;
  }

  async updateStatus(id: number, status: 'PENDING' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED'): Promise<KotDTO> {
    const storeId = getStoreId() || 1;
    const orgId = getOrganizationId() || 1;

    const validStatuses = ['PENDING', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      throw new ValidationError(`Invalid KOT status: ${status}. Must be one of ${validStatuses.join(', ')}`);
    }

    const updated = await this.kotRepo.updateStatus(id, storeId, status, orgId);
    if (!updated) {
      throw new NotFoundError(`KOT with ID #${id} not found`);
    }

    logger.info(`[KotService] Updated KOT #${id} status to ${status}`);
    return updated;
  }

  async recordReprint(id: number): Promise<KotDTO> {
    const storeId = getStoreId() || 1;
    const orgId = getOrganizationId() || 1;

    const updated = await this.kotRepo.recordReprint(id, storeId, orgId);
    if (!updated) {
      throw new NotFoundError(`KOT with ID #${id} not found`);
    }

    logger.info(`[KotService] Recorded reprint for KOT #${id} (Reprint count: ${updated.reprintCount})`);
    return updated;
  }
}

export const kotService = new KotService();
