import { StockAdjustment } from "../../types/stock-adjustment.types";

export interface IStockAdjustmentRepository {
  create(adjData: any, tx?: any): Promise<StockAdjustment>;
  getAll(
    params?: {
      q?: string;
      startDate?: string;
      endDate?: string;
      product_id?: number;
      adjustment_type?: string;
    },
    tx?: any
  ): Promise<StockAdjustment[]>;
  getById(id: number, tx?: any): Promise<StockAdjustment | null>;
}
