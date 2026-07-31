import { UniversalReceiptModel, createCanonicalReceiptModel } from "./receipt-model";
import { UniversalReceiptRenderer, RenderOptions } from "./universal-receipt-renderer";
import { getPrintAdapter, PrintAdapter } from "./print-adapter";
import { toast } from "sonner";

export interface PrintJob {
  id: string;
  model: UniversalReceiptModel;
  options?: RenderOptions;
  status: "pending" | "printing" | "success" | "failed";
  error?: string;
  timestamp: number;
}

export class PrinterService {
  private static instance: PrinterService;
  private jobQueue: PrintJob[] = [];
  private isProcessing = false;

  public static getInstance(): PrinterService {
    if (!PrinterService.instance) {
      PrinterService.instance = new PrinterService();
    }
    return PrinterService.instance;
  }

  async print(receiptInput: any, printerType: string = "browser", options?: RenderOptions): Promise<boolean> {
    const startTime = Date.now();
    const model = createCanonicalReceiptModel(receiptInput);
    const adapter = getPrintAdapter(printerType);

    const job: PrintJob = {
      id: `JOB-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      model,
      options,
      status: "pending",
      timestamp: startTime,
    };

    this.jobQueue.push(job);
    return this.processJob(job, adapter);
  }

  private async processJob(job: PrintJob, adapter: PrintAdapter): Promise<boolean> {
    job.status = "printing";
    try {
      console.log(`[PrinterService] Dispatching job ${job.id} to ${adapter.constructor.name}...`);
      await adapter.print(job.model, job.options);
      job.status = "success";
      console.log(`[PrinterService] Job ${job.id} printed successfully in ${Date.now() - job.timestamp} ms.`);
      return true;
    } catch (err: any) {
      job.status = "failed";
      job.error = err.message || "Print failure";
      console.error(`[PrinterService] Job ${job.id} failed:`, err);
      toast.error(`Print failed: ${job.error}`);
      return false;
    }
  }

  async runTestPrint(printerType: string = "browser", paperWidth: string = "80mm"): Promise<boolean> {
    const testInput = {
      invoiceNumber: "TEST-V2-001",
      date: new Date().toLocaleDateString("en-IN"),
      businessName: "APKA BILL V2 STORE",
      businessAddress: "42 Enterprise Way, Commercial Complex",
      businessPhone: "9876543210",
      businessGst: "27AAAAA0000A1Z5",
      cashierName: "Admin",
      customerName: "Hardware Test Verification",
      items: [
        { id: 1, name: "Sample Item A (Universal Model)", qty: 1, price: 100, total: 100 },
        { id: 2, name: "Sample Item B (Cut & Drawer)", qty: 2, price: 50, total: 100 },
      ],
      subtotal: 200,
      discount: 10,
      tax: 9,
      total: 199,
      paymentMethod: "CASH",
      footerText: "Apka Bill V2 Universal Print Engine Active!",
    };

    const renderOpts: RenderOptions = {
      paperWidth: paperWidth as any,
      showLogo: true,
      showQr: true,
      showBarcode: true,
      autoCut: true,
      openDrawer: true,
    };

    return await this.print(testInput, printerType, renderOpts);
  }

  getJobQueue(): PrintJob[] {
    return this.jobQueue;
  }

  clearQueue(): void {
    this.jobQueue = [];
  }
}

export const printerService = PrinterService.getInstance();
