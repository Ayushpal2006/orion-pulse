import { UniversalReceiptModel, createCanonicalReceiptModel } from "./receipt-model";
import { UniversalReceiptRenderer, RenderOptions } from "./universal-receipt-renderer";
import { getPrintAdapter, PrintAdapter } from "./print-adapter";
import { toast } from "sonner";
import { PrinterProfile, DEFAULT_PRINTER_PROFILES, printerProfileService } from "./printer-profile.service";

export type { PrinterProfile };
export { DEFAULT_PRINTER_PROFILES, printerProfileService };

export interface PrintJob {
  id: string;
  model: UniversalReceiptModel;
  profile?: PrinterProfile;
  options?: RenderOptions;
  status: "pending" | "printing" | "success" | "failed";
  error?: string;
  timestamp: number;
  durationMs?: number;
}

export interface PrinterDiagnostics {
  status: "ONLINE" | "READY" | "OFFLINE" | "ERROR";
  connectionType: string;
  paperWidth: string;
  activeProfileName: string;
  lastPrintTimestamp: string | null;
  averagePrintTimeMs: number;
  totalPrintCount: number;
  pendingJobs: number;
  lastError: string | null;
  storeName: string;
  organizationName: string;
}

export class PrinterService {
  private static instance: PrinterService;
  private jobQueue: PrintJob[] = [];
  private totalPrintCount = 0;
  private totalPrintTimeMs = 0;
  private lastPrintTimestamp: string | null = null;
  private lastError: string | null = null;

  public static getInstance(): PrinterService {
    if (!PrinterService.instance) {
      PrinterService.instance = new PrinterService();
    }
    return PrinterService.instance;
  }

  async print(receiptInput: any, profile?: PrinterProfile, options?: RenderOptions): Promise<boolean> {
    const startTime = Date.now();

    // Resolve store profile if not passed explicitly
    let activeProfile = profile;
    if (!activeProfile) {
      const config = await printerProfileService.getStorePrinterConfig();
      activeProfile = config.activeProfile;
    }

    const model = createCanonicalReceiptModel(receiptInput);
    const connType = activeProfile?.connectionType || (typeof receiptInput === "string" ? receiptInput : "browser");
    const adapter = getPrintAdapter(connType);

    const mergedOptions: RenderOptions = {
      paperWidth: activeProfile?.paperWidth || options?.paperWidth || "80mm",
      showLogo: activeProfile?.showLogo ?? options?.showLogo ?? true,
      showQr: activeProfile?.showQr ?? options?.showQr ?? true,
      showBarcode: activeProfile?.showBarcode ?? options?.showBarcode ?? true,
      autoCut: activeProfile?.autoCut ?? options?.autoCut ?? true,
      marginTop: activeProfile?.marginTop ?? options?.marginTop ?? 0,
      marginBottom: activeProfile?.marginBottom ?? options?.marginBottom ?? 0,
      marginLeft: activeProfile?.marginLeft ?? options?.marginLeft ?? 0,
      marginRight: activeProfile?.marginRight ?? options?.marginRight ?? 0,
      ...options,
    };

    const job: PrintJob = {
      id: `JOB-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      model,
      profile: activeProfile,
      options: mergedOptions,
      status: "pending",
      timestamp: startTime,
    };

    this.jobQueue.push(job);
    return this.processJob(job, adapter);
  }

  private async processJob(job: PrintJob, adapter: PrintAdapter): Promise<boolean> {
    job.status = "printing";
    const start = Date.now();
    try {
      console.log(`[PrinterService] Dispatching job ${job.id} to ${adapter.constructor.name}...`);
      await adapter.print(job.model, job.options);

      const duration = Date.now() - start;
      job.status = "success";
      job.durationMs = duration;

      this.totalPrintCount++;
      this.totalPrintTimeMs += duration;
      this.lastPrintTimestamp = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
      this.lastError = null;

      // Remove completed job from queue
      this.jobQueue = this.jobQueue.filter((j) => j.id !== job.id);

      console.log(`[PrinterService] Job ${job.id} printed successfully in ${duration} ms.`);
      return true;
    } catch (err: any) {
      job.status = "failed";
      job.error = err.message || "Print failure";
      this.lastError = job.error;

      // Keep failed job in queue for diagnostic inspection
      console.error(`[PrinterService] Job ${job.id} failed:`, err);
      toast.error(`Print failed: ${job.error}`);
      return false;
    }
  }

  /**
   * Run real hardware test print using the currently active profile and store metadata
   */
  async runTestPrint(profile?: PrinterProfile, storeInfo?: any, orgInfo?: any): Promise<boolean> {
    const activeProf = profile || DEFAULT_PRINTER_PROFILES[0];
    const nowStr = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

    const storeName = storeInfo?.name || storeInfo?.shop_name || "APKA BILL MAIN OUTLET";
    const orgName = orgInfo?.name || "ORION RETAIL SYSTEMS";
    const address = storeInfo?.address || storeInfo?.shop_address || "123 POS Center, Salt Lake, Kolkata";
    const phone = storeInfo?.phone || storeInfo?.shop_phone || "8285068670";
    const gstin = storeInfo?.gst_number || storeInfo?.shop_gstin || "27AAAAA1111A1Z1";
    const logoUrl = storeInfo?.logo || storeInfo?.shop_logo || "";

    const testInput = {
      invoiceNumber: `TEST-${Date.now().toString().slice(-6)}`,
      date: nowStr.split(",")[0] || "Today",
      time: nowStr.split(",")[1] || "Now",
      businessName: orgName,
      businessAddress: address,
      businessPhone: phone,
      businessGst: gstin,
      logoUrl: logoUrl,
      store: { name: storeName },
      cashierName: "Diagnostics Engine",
      customerName: "Hardware Test Verification",
      items: [
        { id: 1, name: `Profile: ${activeProf.name}`, qty: 1, price: 0, total: 0 },
        { id: 2, name: `Connection: ${activeProf.connectionType.toUpperCase()}`, qty: 1, price: 0, total: 0 },
        { id: 3, name: `Width: ${activeProf.paperWidth} | Cut: ${activeProf.autoCut ? "ON" : "OFF"}`, qty: 1, price: 100, total: 100 },
        { id: 4, name: `Margins: Top ${activeProf.marginTop}mm / Bot ${activeProf.marginBottom}mm`, qty: 1, price: 50, total: 50 },
      ],
      subtotal: 150,
      discount: 10,
      tax: 25.2,
      total: 165.2,
      paymentMethod: "TEST_MODE",
      footerText: `Test Print Successful! Timestamp: ${nowStr}. Auto-Cut Test: ${activeProf.autoCut ? "Passed" : "Disabled"}.`,
    };

    const renderOpts: RenderOptions = {
      paperWidth: activeProf.paperWidth,
      showLogo: activeProf.showLogo,
      showQr: activeProf.showQr,
      showBarcode: activeProf.showBarcode,
      autoCut: activeProf.autoCut,
      marginTop: activeProf.marginTop,
      marginBottom: activeProf.marginBottom,
      marginLeft: activeProf.marginLeft,
      marginRight: activeProf.marginRight,
    };

    toast.info(`Executing REAL Test Print for ${activeProf.name} (${activeProf.paperWidth})...`);
    return await this.print(testInput, activeProf, renderOpts);
  }

  getDiagnostics(profile?: PrinterProfile, storeInfo?: any, orgInfo?: any): PrinterDiagnostics {
    const avgTime = this.totalPrintCount > 0 ? Math.round(this.totalPrintTimeMs / this.totalPrintCount) : 0;
    const activeProfName = profile?.name || DEFAULT_PRINTER_PROFILES[0].name;
    const connType = profile?.connectionType || "browser";
    const width = profile?.paperWidth || "80mm";

    const storeName = storeInfo?.name || storeInfo?.shop_name || "Apka Bill Store";
    const orgName = orgInfo?.name || "Apka Bill Retail";
    const pendingCount = this.jobQueue.filter((j) => j.status === "pending" || j.status === "printing").length;

    return {
      status: this.lastError ? "ERROR" : this.totalPrintCount > 0 ? "ONLINE" : "READY",
      connectionType: connType.toUpperCase(),
      paperWidth: width,
      activeProfileName: activeProfName,
      lastPrintTimestamp: this.lastPrintTimestamp || "None",
      averagePrintTimeMs: avgTime,
      totalPrintCount: this.totalPrintCount,
      pendingJobs: pendingCount,
      lastError: this.lastError || "None",
      storeName: storeName,
      organizationName: orgName,
    };
  }

  getJobQueue(): PrintJob[] {
    return this.jobQueue;
  }

  clearQueue(): void {
    this.jobQueue = [];
  }
}

export const printerService = PrinterService.getInstance();
