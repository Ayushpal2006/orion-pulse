import { Sale } from "../../types/checkout.types";
import { DatabaseAdapter } from "../../database";

export interface ISaleRepository {
  getAll(tx?: DatabaseAdapter): Promise<Sale[]>;
  getById(id: number, tx?: DatabaseAdapter): Promise<Sale | null>;
  getByInvoice(invoice: string, tx?: DatabaseAdapter): Promise<Sale | null>;
  getTodaySales(tx?: DatabaseAdapter): Promise<Sale[]>;
  getSaleItems(saleId: number, tx?: DatabaseAdapter): Promise<any[]>;
  getByCustomerPhone(phone: string, tx?: DatabaseAdapter): Promise<Sale[]>;
  getLastInvoiceNumber(tx?: DatabaseAdapter): Promise<string | null>;
  updatePdfUrlByInvoice(invoiceNumber: string, pdfUrl: string, tx?: DatabaseAdapter): Promise<boolean>;
  getByPublicToken(token: string, tx?: DatabaseAdapter): Promise<Sale | null>;
  searchSales(
    params: {
      invoiceNumber?: string;
      customerName?: string;
      phone?: string;
      date?: string;
      cashier?: string;
      paymentMethod?: string;
      startDate?: string;
      endDate?: string;
    },
    tx?: DatabaseAdapter
  ): Promise<any[]>;
  getSalesExport(
    filter: string,
    startDate?: string,
    endDate?: string,
    tx?: DatabaseAdapter
  ): Promise<any[]>;
}
