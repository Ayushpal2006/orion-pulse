import { UniversalReceiptModel, createCanonicalReceiptModel } from "./receipt-model";
import { UniversalReceiptRenderer, RenderOptions } from "./universal-receipt-renderer";
import { getPrintAdapter, PrintAdapter } from "./print-adapter";
import { toast } from "sonner";

export interface PrinterProfile {
  id: string;
  name: string;
  isDefault: boolean;
  connectionType: "browser" | "escpos" | "usb" | "bluetooth" | "lan" | "android_pos";
  paperWidth: "58mm" | "80mm" | "A4";
  receiptTemplate: "Classic" | "Compact" | "Modern" | "Retail" | "Minimal";
  autoCut: boolean;
  showLogo: boolean;
  showQr: boolean;
  showBarcode: boolean;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  printerIp?: string;
  printerPort?: number;
  usbVendorId?: string;
  usbProductId?: string;
  bluetoothDeviceName?: string;
}

export const DEFAULT_PRINTER_PROFILES: PrinterProfile[] = [
  {
    id: "prof-counter-01",
    name: "Counter Thermal Printer",
    isDefault: true,
    connectionType: "browser",
    paperWidth: "80mm",
    receiptTemplate: "Classic",
    autoCut: true,
    showLogo: true,
    showQr: true,
    showBarcode: true,
    marginTop: 0,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
  },
  {
    id: "prof-office-a4",
    name: "Office A4 Printer",
    isDefault: false,
    connectionType: "browser",
    paperWidth: "A4",
    receiptTemplate: "Modern",
    autoCut: false,
    showLogo: true,
    showQr: true,
    showBarcode: false,
    marginTop: 10,
    marginBottom: 10,
    marginLeft: 10,
    marginRight: 10,
  },
];

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
  lastError: string | null;
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
    const model = createCanonicalReceiptModel(receiptInput);
    
    // Resolve connection type and options from active profile if passed
    const connType = profile?.connectionType || (typeof receiptInput === "string" ? receiptInput : "browser");
    const adapter = getPrintAdapter(connType);

    const mergedOptions: RenderOptions = {
      paperWidth: profile?.paperWidth || options?.paperWidth || "80mm",
      showLogo: profile?.showLogo ?? options?.showLogo ?? true,
      showQr: profile?.showQr ?? options?.showQr ?? true,
      showBarcode: profile?.showBarcode ?? options?.showBarcode ?? true,
      autoCut: profile?.autoCut ?? options?.autoCut ?? true,
      marginTop: profile?.marginTop ?? options?.marginTop ?? 0,
      marginBottom: profile?.marginBottom ?? options?.marginBottom ?? 0,
      marginLeft: profile?.marginLeft ?? options?.marginLeft ?? 0,
      marginRight: profile?.marginRight ?? options?.marginRight ?? 0,
      ...options,
    };

    const job: PrintJob = {
      id: `JOB-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      model,
      profile,
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

      console.log(`[PrinterService] Job ${job.id} printed successfully in ${duration} ms.`);
      return true;
    } catch (err: any) {
      job.status = "failed";
      job.error = err.message || "Print failure";
      this.lastError = job.error;
      console.error(`[PrinterService] Job ${job.id} failed:`, err);
      toast.error(`Print failed: ${job.error}`);
      return false;
    }
  }

  async runTestPrint(profile?: PrinterProfile, storeInfo?: any): Promise<boolean> {
    const activeProf = profile || DEFAULT_PRINTER_PROFILES[0];
    const nowStr = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

    const testInput = {
      invoiceNumber: `TEST-CALIB-${Date.now().toString().slice(-6)}`,
      date: nowStr.split(",")[0] || "Today",
      time: nowStr.split(",")[1] || "Now",
      businessName: storeInfo?.name || storeInfo?.shop_name || "APKA BILL DIAGNOSTICS",
      businessAddress: storeInfo?.address || storeInfo?.shop_address || "Hardware Calibration Suite",
      businessPhone: storeInfo?.phone || storeInfo?.shop_phone || "1800-POS-TEST",
      businessGst: storeInfo?.gst_number || storeInfo?.shop_gstin || "27AAAAA0000A1Z5",
      cashierName: "Diagnostics Engine",
      customerName: "Hardware Test Verification",
      items: [
        { id: 1, name: `Profile: ${activeProf.name}`, qty: 1, price: 0, total: 0 },
        { id: 2, name: `Method: ${activeProf.connectionType.toUpperCase()}`, qty: 1, price: 0, total: 0 },
        { id: 3, name: `Width: ${activeProf.paperWidth} | Cut: ${activeProf.autoCut ? "ON" : "OFF"}`, qty: 1, price: 100, total: 100 },
      ],
      subtotal: 100,
      discount: 0,
      tax: 18,
      total: 118,
      paymentMethod: "TEST_MODE",
      footerText: `Test Print Successful at ${nowStr}! Margins: ${activeProf.marginTop}mm/${activeProf.marginBottom}mm`,
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

    toast.info(`Running REAL Test Print for ${activeProf.name} (${activeProf.paperWidth})...`);
    return await this.print(testInput, activeProf, renderOpts);
  }

  getDiagnostics(profile?: PrinterProfile): PrinterDiagnostics {
    const avgTime = this.totalPrintCount > 0 ? Math.round(this.totalPrintTimeMs / this.totalPrintCount) : 0;
    const activeProfName = profile?.name || DEFAULT_PRINTER_PROFILES[0].name;
    const connType = profile?.connectionType || "browser";
    const width = profile?.paperWidth || "80mm";

    return {
      status: this.lastError ? "ERROR" : "ONLINE",
      connectionType: connType.toUpperCase(),
      paperWidth: width,
      activeProfileName: activeProfName,
      lastPrintTimestamp: this.lastPrintTimestamp,
      averagePrintTimeMs: avgTime,
      totalPrintCount: this.totalPrintCount,
      lastError: this.lastError,
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
