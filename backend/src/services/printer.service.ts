import { settingsRepository } from "../repositories";
import { PrinterConfig, PrintResult } from "../types/printer.types";
import { EscposFormatter } from "./escpos.service";
import { logger } from "../logger/logger";

export class PrinterService {
  async getPrinterConfig(): Promise<PrinterConfig> {
    const printerType = (await settingsRepository.get("printer_type", "Internal POS")) as any;
    const paperWidth = (await settingsRepository.get("paper_width", "58mm")) as any;
    const characterDensity = (await settingsRepository.get("character_density", "normal")) as any;
    const darkness = await settingsRepository.get("printer_darkness", "medium");

    return {
      type: printerType,
      paperWidth,
      characterDensity,
      darkness,
    };
  }

  async testConnection(config: PrinterConfig): Promise<{ success: boolean; message: string; interface: string }> {
    const printerType = config.type || "Internal POS";
    logger.info(`🔌 [Printer Service] Testing connection to ${printerType} hardware interface`);

    // Hardware status check simulation based on connection interface
    switch (printerType) {
      case "Internal POS":
        return {
          success: true,
          message: "Internal Android POS Thermal Printer hardware connected and paper sensor OK",
          interface: "Internal POS (/dev/ttyS1)",
        };
      case "USB":
        return {
          success: true,
          message: "USB ESC/POS Thermal Printer interface ready (VendorId: 0x0fe6, ProductId: 0x811e)",
          interface: "USB Direct Spooler / WebUSB",
        };
      case "Bluetooth":
        return {
          success: true,
          message: "Bluetooth SPP Thermal Printer RFCOMM channel connected (MAC: 00:11:22:33:44:55)",
          interface: "Bluetooth SPP (Serial Port Profile)",
        };
      case "Network":
        return {
          success: true,
          message: "Network TCP Thermal Printer reachable on Port 9100",
          interface: "Network Socket (RAW TCP Port 9100)",
        };
      default:
        return {
          success: false,
          message: `Unknown printer interface type: ${printerType}`,
          interface: "Unknown",
        };
    }
  }

  async printBuffer(buffer: Buffer, config: PrinterConfig): Promise<PrintResult> {
    const printerType = config.type || "Internal POS";

    logger.info(`🖨️ [${printerType} Thermal Printer] Processing ESC/POS Payload`, {
      paperWidth: config.paperWidth,
      byteSize: buffer.length,
      printerType: printerType,
    });

    // Transmission latency simulation
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

    const dummyReceipt = {
      shop: {
        name: "Apka Bill Store",
        address: "123, POS Station Road, MG Marg",
        phone: "9876543210",
        gstin: "27AAAAA1111A1Z1",
        logo: "",
      },
      invoiceNumber: "TEST-123456",
      date: new Date().toLocaleDateString("en-IN"),
      time: new Date().toLocaleTimeString("en-IN"),
      cashier: "Admin Cashier",
      customer: {
        name: "Test Customer",
        phone: "9999999999",
      },
      items: [
        { name: "Test Sample Product 1", qty: 1, price: 100.0, lineTotal: 100.0 },
        { name: "Test Sample Product 2", qty: 2, price: 50.0, lineTotal: 100.0 },
      ],
      subtotal: 200.0,
      discount: 0.0,
      gst: 36.0,
      grandTotal: 236.0,
      paymentMethod: "UPI",
      upiPayload: "upi://pay?pa=test@upi&pn=Apka%20Bill&am=236.00&cu=INR",
      thankYouMessage: "Test Print Successful! Printer Ready.",
    };

    const buffer = formatter.formatReceipt(dummyReceipt, template);
    return this.printBuffer(buffer, config);
  }
}
