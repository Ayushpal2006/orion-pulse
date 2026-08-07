import { reportsRepository } from "../repositories";

export class ReportsService {
  private repo = reportsRepository;

  async getReportsData(filter: string, startDate?: string, endDate?: string, showVoid: boolean = false) {
    const [
      summary,
      topProducts,
      gstSummary,
      paymentMethodSplit,
      salesSeries,
      recentInvoices,
      topCustomers,
      lowStockCount,
      productsSummary,
    ] = await Promise.all([
      this.repo.getSummary(filter, startDate, endDate, showVoid),
      this.repo.getTopProducts(filter, startDate, endDate, showVoid),
      this.repo.getGstSummary(filter, startDate, endDate, showVoid),
      this.repo.getPaymentSplit(filter, startDate, endDate, showVoid),
      this.repo.getTrendSeries(filter, startDate, endDate, showVoid),
      this.repo.getRecentInvoices(filter, startDate, endDate, showVoid),
      this.repo.getTopCustomers(filter, startDate, endDate, showVoid),
      this.repo.getLowStockCount(),
      this.repo.getProductsSummary(filter, startDate, endDate, showVoid),
    ]);

    return {
      ...summary,
      topProducts,
      gstSummary,
      paymentMethodSplit,
      salesSeries,
      recentInvoices,
      topCustomers,
      lowStockCount,
      productsSummary,
    };
  }
}
