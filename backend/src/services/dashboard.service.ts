import { dashboardRepository } from "../repositories";

export class DashboardService {
  private repo = dashboardRepository;

  async getDashboardData() {
    const [summary, topProducts, recentSales] = await Promise.all([
      this.repo.getTodaySummary(),
      this.repo.getTopProducts(),
      this.repo.getRecentSales(),
    ]);

    return {
      ...summary,
      topProducts,
      recentSales,
    };
  }
}
