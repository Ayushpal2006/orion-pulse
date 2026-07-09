import { SaleRepository } from "../repositories/sale.repository";
import { CustomerRepository } from "../repositories/customer.repository";
import { NotFoundError } from "./product.service";
import { Sale, SaleDetailResponse } from "../types/checkout.types";

export class SalesService {
  private saleRepo: SaleRepository;
  private customerRepo: CustomerRepository;

  constructor() {
    this.saleRepo = new SaleRepository();
    this.customerRepo = new CustomerRepository();
  }

  async getAll(): Promise<Sale[]> {
    return this.saleRepo.getAll();
  }

  async getById(id: number): Promise<SaleDetailResponse> {
    const sale = this.saleRepo.getById(id);
    if (!sale) {
      throw new NotFoundError(`Sale with ID ${id} not found`);
    }

    const customer = sale.customer_id ? this.customerRepo.getById(sale.customer_id) : null;
    const items = this.saleRepo.getSaleItems(sale.id);

    return {
      sale,
      customer,
      items,
      totals: {
        subtotal: sale.subtotal,
        discount: sale.discount,
        gst: sale.gst,
        grand_total: sale.grand_total,
      },
    };
  }

  async getByInvoice(invoice: string): Promise<SaleDetailResponse> {
    const sale = this.saleRepo.getByInvoice(invoice);
    if (!sale) {
      throw new NotFoundError(`Sale with invoice number "${invoice}" not found`);
    }

    const customer = sale.customer_id ? this.customerRepo.getById(sale.customer_id) : null;
    const items = this.saleRepo.getSaleItems(sale.id);

    return {
      sale,
      customer,
      items,
      totals: {
        subtotal: sale.subtotal,
        discount: sale.discount,
        gst: sale.gst,
        grand_total: sale.grand_total,
      },
    };
  }

  async getTodaySales(): Promise<Sale[]> {
    return this.saleRepo.getTodaySales();
  }
}
