import { logger } from "../logger/logger";
import { PrinterConfig, PrintResult } from "../types/printer.types";

export interface PrintJob {
  id: string;
  invoiceNumber: string;
  copyType: string;
  config: PrinterConfig;
  payload: Buffer;
  status: "QUEUED" | "PRINTING" | "COMPLETED" | "FAILED";
  retryCount: number;
  maxRetries: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export class PrintQueueManager {
  private static instance: PrintQueueManager;
  private queue: PrintJob[] = [];
  private isProcessing = false;
  private isPaused = false;

  private constructor() {}

  public static getInstance(): PrintQueueManager {
    if (!PrintQueueManager.instance) {
      PrintQueueManager.instance = new PrintQueueManager();
    }
    return PrintQueueManager.instance;
  }

  public enqueue(invoiceNumber: string, payload: Buffer, config: PrinterConfig, copyType = "CUSTOMER COPY"): PrintJob {
    const job: PrintJob = {
      id: `PJ-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      invoiceNumber,
      copyType,
      config,
      payload,
      status: "QUEUED",
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.queue.push(job);
    logger.info(`🖨️ [PrintQueue] Job #${job.id} enqueued for Invoice ${invoiceNumber} (${copyType})`);

    // Process asynchronously without blocking caller thread
    setImmediate(() => this.processQueue());
    return job;
  }

  public async processQueue(): Promise<void> {
    if (this.isProcessing || this.isPaused) return;
    this.isProcessing = true;

    while (this.queue.some((j) => j.status === "QUEUED")) {
      const nextJob = this.queue.find((j) => j.status === "QUEUED");
      if (!nextJob) break;

      nextJob.status = "PRINTING";
      nextJob.updatedAt = new Date().toISOString();

      try {
        // Transmission latency simulation
        await new Promise((resolve) => setTimeout(resolve, 80));

        nextJob.status = "COMPLETED";
        nextJob.updatedAt = new Date().toISOString();
        logger.info(`✅ [PrintQueue] Job #${nextJob.id} completed successfully`);
      } catch (err: any) {
        nextJob.retryCount += 1;
        nextJob.errorMessage = err.message || "Hardware transmission failure";

        if (nextJob.retryCount < nextJob.maxRetries) {
          nextJob.status = "QUEUED";
          logger.warn(`⚠️ [PrintQueue] Job #${nextJob.id} failed. Retrying (${nextJob.retryCount}/${nextJob.maxRetries})…`);
        } else {
          nextJob.status = "FAILED";
          logger.error(`❌ [PrintQueue] Job #${nextJob.id} permanently failed: ${nextJob.errorMessage}`);
        }
      }
    }

    this.isProcessing = false;
  }

  public retryJob(jobId: string): boolean {
    const job = this.queue.find((j) => j.id === jobId);
    if (!job || job.status !== "FAILED") return false;

    job.status = "QUEUED";
    job.retryCount = 0;
    job.errorMessage = undefined;
    job.updatedAt = new Date().toISOString();

    setImmediate(() => this.processQueue());
    return true;
  }

  public cancelJob(jobId: string): boolean {
    const index = this.queue.findIndex((j) => j.id === jobId);
    if (index === -1) return false;

    this.queue.splice(index, 1);
    logger.info(`🚫 [PrintQueue] Job #${jobId} cancelled`);
    return true;
  }

  public pauseQueue(): void {
    this.isPaused = true;
    logger.info(`⏸️ [PrintQueue] Processing paused`);
  }

  public resumeQueue(): void {
    this.isPaused = false;
    logger.info(`▶️ [PrintQueue] Processing resumed`);
    setImmediate(() => this.processQueue());
  }

  public getQueueStatus(): { total: number; queued: number; printing: number; completed: number; failed: number; jobs: PrintJob[] } {
    return {
      total: this.queue.length,
      queued: this.queue.filter((j) => j.status === "QUEUED").length,
      printing: this.queue.filter((j) => j.status === "PRINTING").length,
      completed: this.queue.filter((j) => j.status === "COMPLETED").length,
      failed: this.queue.filter((j) => j.status === "FAILED").length,
      jobs: [...this.queue],
    };
  }
}
