import { Sale, SaleItem } from "../../types/checkout.types";
import { DatabaseAdapter } from "../../database";

export interface ICheckoutRepository {
  createSale(sale: Omit<Sale, "id" | "created_at">, tx?: DatabaseAdapter): Promise<number>;
  createSaleItem(item: Omit<SaleItem, "id">, tx?: DatabaseAdapter): Promise<void>;
}
