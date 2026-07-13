export interface PrinterConfig {
  type: "Internal POS" | "Bluetooth" | "USB";
  paperWidth: "58mm" | "80mm";
  characterDensity: "normal" | "compact";
  darkness: string;
}

export interface PrintResult {
  success: boolean;
  message: string;
  bytesWritten: number;
}
