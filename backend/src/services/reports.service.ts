import { reportsRepository } from "../repositories";

export class ReportsService {
  private repo = reportsRepository;

  async getReportsData(filter: string, startDate?: string, endDate?: string, showVoid: boolean = false) {
    const summary = await this.repo.getSummary(filter, startDate, endDate, showVoid);
    const topProducts = await this.repo.getTopProducts(filter, startDate, endDate, showVoid);
    const gstSummary = await this.repo.getGstSummary(filter, startDate, endDate, showVoid);
    const paymentMethodSplit = await this.repo.getPaymentSplit(filter, startDate, endDate, showVoid);
    const salesSeries = await this.repo.getTrendSeries(filter, startDate, endDate, showVoid);
    const recentInvoices = await this.repo.getRecentInvoices(filter, startDate, endDate, showVoid);
    const topCustomers = await this.repo.getTopCustomers(filter, startDate, endDate, showVoid);
    const lowStockCount = await this.repo.getLowStockCount();

    const productsSummary = await this.repo.getProductsSummary(filter, startDate, endDate, showVoid);

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
