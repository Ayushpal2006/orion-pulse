// Enterprise Printer Calibration & Health Diagnostics System for Apka Bill V2

import { printerService } from "./printer.service";

export interface PrinterCalibrationConfig {
  paperWidth: "58mm" | "80mm" | "A4" | "Custom";
  customWidthMm: number;
  charsPerLine: number;
  leftMarginDots: number;
  rightMarginDots: number;
  darknessLevel: number; // 1 to 10
  density: number; // 1 to 5
  align: "left" | "center" | "right";
  autoCut: boolean;
  drawerPulse: boolean;
}

export type HardwareStatus =
  | "Connected"
  | "Offline"
  | "Busy"
  | "Paper Out"
  | "Cover Open"
  | "Permission Missing"
  | "Network Error"
  | "Bluetooth Disconnected"
  | "USB Permission Denied";

export interface PrinterDiagnosticsReport {
  printerType: string;
  paperWidth: string;
  connectionType: string;
  status: HardwareStatus;
  lastPrintTimestamp: string | null;
  lastError: string | null;
  averagePrintTimeMs: number;
  totalPrintsCount: number;
  firmwareVersion?: string;
  driverName?: string;
}

const CALIBRATION_STORAGE_KEY = "orion_pos_printer_calibration";

export const DEFAULT_CALIBRATION_CONFIG: PrinterCalibrationConfig = {
  paperWidth: "80mm",
  customWidthMm: 80,
  charsPerLine: 48,
  leftMarginDots: 0,
  rightMarginDots: 0,
  darknessLevel: 5,
  density: 3,
  align: "left",
  autoCut: true,
  drawerPulse: true,
};

export function getPrinterCalibrationConfig(): PrinterCalibrationConfig {
  if (typeof window === "undefined") return DEFAULT_CALIBRATION_CONFIG;
  try {
    const raw = localStorage.getItem(CALIBRATION_STORAGE_KEY);
    if (raw) return { ...DEFAULT_CALIBRATION_CONFIG, ...JSON.parse(raw) };
  } catch {
    // fallback
  }
  return DEFAULT_CALIBRATION_CONFIG;
}

export function savePrinterCalibrationConfig(config: PrinterCalibrationConfig): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.warn("Failed to persist printer calibration config:", err);
  }
}

export async function runCalibrationTest(printerType: string, config: PrinterCalibrationConfig): Promise<{ success: boolean; report: PrinterDiagnosticsReport }> {
  const startTime = performance.now();
  const testProfile: any = {
    id: "calibration-test",
    name: "Calibration Test",
    connectionType: printerType as any,
    paperWidth: config.paperWidth === "Custom" ? "80mm" : config.paperWidth,
    autoCut: config.autoCut,
    charsPerLine: config.charsPerLine,
  };
  const success = await printerService.runTestPrint(testProfile);
  const endTime = performance.now();
  const latency = Math.round(endTime - startTime);

  const report: PrinterDiagnosticsReport = {
    printerType,
    paperWidth: config.paperWidth === "Custom" ? `${config.customWidthMm}mm` : config.paperWidth,
    connectionType: printerType.toUpperCase(),
    status: success ? "Connected" : "Network Error",
    lastPrintTimestamp: new Date().toLocaleTimeString("en-IN"),
    lastError: success ? null : "Hardware test dispatch failed",
    averagePrintTimeMs: latency,
    totalPrintsCount: printerService.getJobQueue().length,
    firmwareVersion: "ESC/POS v2.4",
    driverName: `Apka Bill ${printerType.toUpperCase()} Native Adapter`,
  };

  return { success, report };
}
