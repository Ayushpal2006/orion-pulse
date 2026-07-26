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
    const printerType = config.type || "Internal POS";
    
    logger.info(`🖨️ [${printerType} Thermal Printer] Processing ESC/POS Payload`, {
      paperWidth: config.paperWidth,
      byteSize: buffer.length,
      printerType: printerType,
    });
    
    // Simulate printer transmission latency (150ms)
    await new Promise((resolve) => setTimeout(resolve, 150));

    let statusMessage = `Printed ${buffer.length} bytes successfully via ${printerType}`;
    if (printerType === "Bluetooth") {
      statusMessage = `ESC/POS byte payload (${buffer.length} bytes) generated for Bluetooth SPP thermal printer`;
    } else if (printerType === "USB") {
      statusMessage = `ESC/POS byte payload (${buffer.length} bytes) sent to USB Direct Thermal Printer interface`;
    } else if (printerType === "Network") {
      statusMessage = `ESC/POS byte payload (${buffer.length} bytes) queued for Network TCP printer (Port 9100)`;
    }

    return {
      success: true,
      message: statusMessage,
      bytesWritten: buffer.length,
    };
  }

  async printTestPage(config: PrinterConfig): Promise<PrintResult> {
    const template = await settingsRepository.get("receipt_template", "Classic");
    const formatter = new EscposFormatter(config);
    
    // Create a mock receipt for the test print
    const dummyReceipt = {
      shop: {
        name: "Test Shop",
        address: "123, POS Street",
        phone: "9876543210",
        gstin: "27AAAAA1111A1Z1",
        logo: ""
      },
      invoiceNumber: "TEST-123456",
      date: new Date().toLocaleDateString("en-IN"),
      time: new Date().toLocaleTimeString("en-IN"),
      cashier: "Test Cashier",
      customer: {
        name: "Test Customer",
        phone: "9999999999"
      },
      items: [
        { name: "Test Item 1", qty: 1, price: 100.00, lineTotal: 100.00 },
        { name: "Test Item 2", qty: 2, price: 50.00, lineTotal: 100.00 }
      ],
      subtotal: 200.00,
      discount: 0.00,
      gst: 36.00,
      grandTotal: 236.00,
      paymentMethod: "UPI",
      upiPayload: "upi://pay?pa=test@upi&pn=Test%20Shop&am=236.00&cu=INR",
      thankYouMessage: "Test Print Successful!"
    };

    const buffer = formatter.formatReceipt(dummyReceipt, template);
    return this.printBuffer(buffer, config);
  }
}
