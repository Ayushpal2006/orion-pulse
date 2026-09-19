import { KotDTO, CreateKotInput } from "../../types/kot.types";

export interface IKotRepository {
  getNextKotNumber(storeId: number, txClient?: any): Promise<number>;
  createKot(orgId: number, storeId: number, input: CreateKotInput, txClient?: any): Promise<KotDTO>;
  getById(id: number, storeId: number, orgId?: number): Promise<KotDTO | null>;
  getBySaleId(saleId: number, storeId: number, orgId?: number): Promise<KotDTO[]>;
  getAll(params: { storeId: number; orgId?: number; status?: string; limit?: number; offset?: number }): Promise<KotDTO[]>;
  updateStatus(id: number, storeId: number, status: string, orgId?: number): Promise<KotDTO | null>;
  recordReprint(id: number, storeId: number, orgId?: number): Promise<KotDTO | null>;
}
