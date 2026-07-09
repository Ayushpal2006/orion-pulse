import { DashboardRepository } from "../repositories/dashboard.repository";

export class DashboardService {
  private repo: DashboardRepository;

  constructor() {
    this.repo = new DashboardRepository();
  }

  async getDashboardData() {
    const summary = this.repo.getTodaySummary();
    const topProducts = this.repo.getTopProducts();
    const recentSales = this.repo.getRecentSales();

    return {
      ...summary,
      topProducts,
      recentSales,
    };
  }
}
