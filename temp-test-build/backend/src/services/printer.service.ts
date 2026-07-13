import { settingsRepository } from "../repositories";
import { PrinterConfig, PrintResult } from "../types/printer.types";
import { EscposFormatter } from "./escpos.service";
import { logger } from "../logger/logger";

export class PrinterService {
  async getPrinterConfig(): Promise<PrinterConfig> {
    const printerType = await settingsRepository.get("printer_type", "Internal POS") as any;
    const paperWidth = await settingsRepository.get("paper_width", "58mm") as any;
    const characterDensity = await settingsRepository.get("character_density", "normal") as any;
    const darkness = await settingsRepository.get("printer_darkness", "medium");

    return {
      type: printerType,
      paperWidth,
      characterDensity,
      darkness,
    };
  }

  async printBuffer(buffer: Buffer, config: PrinterConfig): Promise<PrintResult> {
    if (config.type !== "Internal POS") {
      throw new Error(`Printer '${config.type}' is a placeholder. Only 'Internal POS' is supported now.`);
    }

    logger.info("🖨️ [Z91 Internal POS Printer] Printing ESC/POS Payload", {
      paperWidth: config.paperWidth,
      byteSize: buffer.length,
    });
    
    // Simulate printer latency (300ms)
    await new Promise((resolve) => setTimeout(resolve, 300));

    return {
      success: true,
      message: "Printed successfully on Internal POS",
      bytesWritten: buffer.length,
    };
  }

  async printTestPage(config: PrinterConfig): Promise<PrintResult> {
    const formatter = new EscposFormatter(config);
    formatter.init();
    formatter.alignCenter();
    formatter.bold(true);
    formatter.sizeDoubleWidthHeight();
    formatter.text("Orion POS");
    formatter.lineFeed();
    formatter.sizeNormal();
    formatter.text("Printer Test Page");
    formatter.lineFeed();
    formatter.bold(false);
    formatter.divider();
    formatter.alignLeft();
    formatter.text(`Date: ${new Date().toLocaleDateString("en-IN")}`);
    formatter.lineFeed();
    formatter.text(`Time: ${new Date().toLocaleTimeString("en-IN")}`);
    formatter.lineFeed();
    formatter.text(`Type: ${config.type}`);
    formatter.lineFeed();
    formatter.text(`Width: ${config.paperWidth}`);
    formatter.lineFeed();
    formatter.text(`Density: ${config.characterDensity}`);
    formatter.lineFeed();
    formatter.divider();
    formatter.alignCenter();
    formatter.bold(true);
    formatter.text("SUCCESS");
    formatter.lineFeed(3);
    formatter.cut();

    return this.printBuffer(formatter.getBuffer(), config);
  }
}
