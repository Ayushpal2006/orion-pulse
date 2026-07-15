import { reportsRepository } from "../repositories";

export class ReportsService {
  private repo = reportsRepository;

  async getReportsData(filter: string, startDate?: string, endDate?: string) {
    const summary = await this.repo.getSummary(filter, startDate, endDate);
    const topProducts = await this.repo.getTopProducts(filter, startDate, endDate);
    const gstSummary = await this.repo.getGstSummary(filter, startDate, endDate);
    const paymentMethodSplit = await this.repo.getPaymentSplit(filter, startDate, endDate);
    const salesSeries = await this.repo.getTrendSeries(filter, startDate, endDate);
    const recentInvoices = await this.repo.getRecentInvoices(filter, startDate, endDate);
    const topCustomers = await this.repo.getTopCustomers(filter, startDate, endDate);
    const lowStockCount = await this.repo.getLowStockCount();

    const productsSummary = await this.repo.getProductsSummary(filter, startDate, endDate);

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
