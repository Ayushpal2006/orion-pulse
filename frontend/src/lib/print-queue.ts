// Advanced Asynchronous Print Queue & Multi-Printer Routing Engine for Apka Bill V2

import { UniversalReceiptModel } from "./receipt-model";
import { RenderOptions } from "./universal-receipt-renderer";
import { getPrintAdapter } from "./print-adapter";
import { toast } from "sonner";

export type Priority = "high" | "normal" | "low";
export type PrinterDestination = "counter" | "kitchen" | "invoice" | "label";

export interface QueuedPrintJob {
  id: string;
  model: UniversalReceiptModel;
  destination: PrinterDestination;
  printerType: string;
  priority: Priority;
  options?: RenderOptions;
  status: "queued" | "printing" | "success" | "failed" | "paused";
  retries: number;
  maxRetries: number;
  error?: string;
  enqueuedAt: number;
  completedAt?: number;
}

class PrintQueueManager {
  private static instance: PrintQueueManager;
  private queue: QueuedPrintJob[] = [];
  private history: QueuedPrintJob[] = [];
  private isPaused = false;
  private isProcessing = false;

  public static getInstance(): PrintQueueManager {
    if (!PrintQueueManager.instance) {
      PrintQueueManager.instance = new PrintQueueManager();
    }
    return PrintQueueManager.instance;
  }

  enqueue(
    model: UniversalReceiptModel,
    options?: RenderOptions,
    destination: PrinterDestination = "counter",
    printerType: string = "browser",
    priority: Priority = "normal"
  ): QueuedPrintJob {
    const job: QueuedPrintJob = {
      id: `JOB-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      model,
      destination,
      printerType,
      priority,
      options,
      status: "queued",
      retries: 0,
      maxRetries: 3,
      enqueuedAt: Date.now(),
    };

    // Priority insertion
    if (priority === "high") {
      const idx = this.queue.findIndex((j) => j.priority !== "high");
      if (idx !== -1) {
        this.queue.splice(idx, 0, job);
      } else {
        this.queue.push(job);
      }
    } else {
      this.queue.push(job);
    }

    console.log(`[PrintQueue] Enqueued job ${job.id} (Priority: ${priority}, Target: ${destination})`);
    this.processQueue();
    return job;
  }

  private async processQueue(): Promise<void> {
    if (this.isPaused || this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;
    const job = this.queue.shift()!;
    job.status = "printing";

    try {
      const adapter = getPrintAdapter(job.printerType);
      console.log(`[PrintQueue] Executing job ${job.id} via ${adapter.constructor.name}...`);
      await adapter.print(job.model, job.options);
      
      job.status = "success";
      job.completedAt = Date.now();
      this.history.unshift(job);
      if (this.history.length > 50) this.history.pop();
    } catch (err: any) {
      job.retries++;
      console.warn(`[PrintQueue] Job ${job.id} attempt ${job.retries} failed:`, err);

      if (job.retries < job.maxRetries) {
        job.status = "queued";
        job.error = err.message || "Dispatch error";
        this.queue.push(job); // Re-queue for automatic retry
      } else {
        job.status = "failed";
        job.error = err.message || "Max retries exceeded";
        this.history.unshift(job);
        toast.error(`Print Job ${job.id} failed permanently: ${job.error}`);
      }
    } finally {
      this.isProcessing = false;
      if (this.queue.length > 0) {
        setTimeout(() => this.processQueue(), 100);
      }
    }
  }

  pauseQueue(): void {
    this.isPaused = true;
    toast.info("⏸️ Print Queue Paused");
  }

  resumeQueue(): void {
    this.isPaused = false;
    toast.success("▶️ Print Queue Resumed");
    this.processQueue();
  }

  cancelJob(jobId: string): boolean {
    const idx = this.queue.findIndex((j) => j.id === jobId);
    if (idx !== -1) {
      const removed = this.queue.splice(idx, 1)[0];
      removed.status = "failed";
      removed.error = "Cancelled by user";
      this.history.unshift(removed);
      return true;
    }
    return false;
  }

  getQueueStatus() {
    return {
      isPaused: this.isPaused,
      isProcessing: this.isProcessing,
      queuedCount: this.queue.length,
      historyCount: this.history.length,
      queue: [...this.queue],
      history: [...this.history],
    };
  }
}

export const printQueue = PrintQueueManager.getInstance();
