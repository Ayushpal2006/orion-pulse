import { ReportsRepository } from "../repositories/reports.repository";

export class ReportsService {
  private repo: ReportsRepository;

  constructor() {
    this.repo = new ReportsRepository();
  }

  async getReportsData(filter: string, startDate?: string, endDate?: string) {
    const summary = this.repo.getSummary(filter, startDate, endDate);
    const topProducts = this.repo.getTopProducts(filter, startDate, endDate);
    const gstSummary = this.repo.getGstSummary(filter, startDate, endDate);
    const paymentMethodSplit = this.repo.getPaymentSplit(filter, startDate, endDate);
    const salesSeries = this.repo.getTrendSeries(filter, startDate, endDate);
    const recentInvoices = this.repo.getRecentInvoices(filter, startDate, endDate);
    const topCustomers = this.repo.getTopCustomers(filter, startDate, endDate);
    const lowStockCount = this.repo.getLowStockCount();

    return {
      ...summary,
      topProducts,
      gstSummary,
      paymentMethodSplit,
      salesSeries,
      recentInvoices,
      topCustomers,
      lowStockCount,
    };
  }
}
