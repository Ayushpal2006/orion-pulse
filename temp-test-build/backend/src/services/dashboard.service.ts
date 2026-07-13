import { dashboardRepository } from "../repositories";

export class DashboardService {
  private repo = dashboardRepository;

  async getDashboardData() {
    const summary = await this.repo.getTodaySummary();
    const topProducts = await this.repo.getTopProducts();
    const recentSales = await this.repo.getRecentSales();

    return {
      ...summary,
      topProducts,
      recentSales,
    };
  }
}
