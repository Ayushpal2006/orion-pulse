// High Performance Print Benchmark & Metric Tracker for Apka Bill V2

export interface PrintBenchmarkMetrics {
  checkoutMs: number;
  modelBuildMs: number;
  renderMs: number;
  dispatchMs: number;
  totalCheckoutToPrintMs: number;
  timestamp: number;
}

class PrintBenchmarkTracker {
  private static instance: PrintBenchmarkTracker;
  private metricsHistory: PrintBenchmarkMetrics[] = [];

  public static getInstance(): PrintBenchmarkTracker {
    if (!PrintBenchmarkTracker.instance) {
      PrintBenchmarkTracker.instance = new PrintBenchmarkTracker();
    }
    return PrintBenchmarkTracker.instance;
  }

  recordMetrics(metrics: PrintBenchmarkMetrics): void {
    this.metricsHistory.push(metrics);
    if (this.metricsHistory.length > 100) this.metricsHistory.shift();
  }

  getSummary() {
    if (this.metricsHistory.length === 0) {
      return {
        avgCheckoutMs: 0,
        avgModelBuildMs: 0,
        avgRenderMs: 0,
        avgDispatchMs: 0,
        avgTotalMs: 0,
        p95Ms: 0,
        p99Ms: 0,
        count: 0,
      };
    }

    const totals = this.metricsHistory.map((m) => m.totalCheckoutToPrintMs).sort((a, b) => a - b);
    const count = totals.length;
    const sum = totals.reduce((a, b) => a + b, 0);

    const avgCheckoutMs = this.metricsHistory.reduce((a, b) => a + b.checkoutMs, 0) / count;
    const avgModelBuildMs = this.metricsHistory.reduce((a, b) => a + b.modelBuildMs, 0) / count;
    const avgRenderMs = this.metricsHistory.reduce((a, b) => a + b.renderMs, 0) / count;
    const avgDispatchMs = this.metricsHistory.reduce((a, b) => a + b.dispatchMs, 0) / count;

    return {
      avgCheckoutMs: Math.round(avgCheckoutMs),
      avgModelBuildMs: Number(avgModelBuildMs.toFixed(2)),
      avgRenderMs: Number(avgRenderMs.toFixed(2)),
      avgDispatchMs: Number(avgDispatchMs.toFixed(2)),
      avgTotalMs: Math.round(sum / count),
      p95Ms: Math.round(totals[Math.floor(count * 0.95)] || totals[count - 1]),
      p99Ms: Math.round(totals[Math.floor(count * 0.99)] || totals[count - 1]),
      count,
    };
  }
}

export const printBenchmark = PrintBenchmarkTracker.getInstance();
