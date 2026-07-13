import { inr } from "./format";
import { useApp } from "./store";
import { printSaleReceipt } from "./api";

export interface PrintAdapter {
  print(receipt: any): Promise<void>;
}

export class BrowserPrintAdapter implements PrintAdapter {
  async print(receipt: any): Promise<void> {
    const state = useApp.getState();
    const paperWidth = state.paperWidth;

    // Create the printing section container
    let printSection = document.getElementById("orion-print-section");
    if (!printSection) {
      printSection = document.createElement("div");
      printSection.id = "orion-print-section";
      document.body.appendChild(printSection);
    }

    // Set paper size class
    printSection.className = "";
    if (paperWidth === "58mm") {
      printSection.classList.add("print-58mm");
    } else if (paperWidth === "80mm") {
      printSection.classList.add("print-80mm");
    } else {
      printSection.classList.add("print-a4");
    }

    // Generate HTML content based on paperWidth
    let html = "";
    if (paperWidth === "A4") {
      html = renderA4Html(receipt);
    } else {
      html = renderThermalHtml(receipt, paperWidth);
    }

    printSection.innerHTML = html;

    // Inject temporary styles for page dimensions
    const styleEl = document.createElement("style");
    styleEl.id = "orion-print-style-inject";
    if (paperWidth === "58mm") {
      styleEl.innerHTML = `@page { size: 58mm auto; margin: 0; }`;
    } else if (paperWidth === "80mm") {
      styleEl.innerHTML = `@page { size: 80mm auto; margin: 0; }`;
    } else {
      styleEl.innerHTML = `@page { size: A4; margin: 15mm; }`;
    }
    document.head.appendChild(styleEl);

    // Wait for all images inside printSection to be loaded/decoded
    const images = Array.from(printSection.querySelectorAll("img"));
    const imagePromises = images.map((img) => {
      if (img.complete) {
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        img.addEventListener("load", () => resolve(), { once: true });
        img.addEventListener("error", () => resolve(), { once: true });
      });
    });
    await Promise.all(imagePromises);

    // Wait for all fonts to load
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

    // Wait one animation frame to ensure browser finishes rendering / layout paint
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    // Call window.print()
    window.print();

    // Clean up temporary styles and container after printing
    setTimeout(() => {
      styleEl.remove();
      if (printSection) printSection.remove();
    }, 1000);
  }
}

export class PosPrintAdapter implements PrintAdapter {
  async print(receipt: any): Promise<void> {
    console.log("[PosPrintAdapter] Placeholder print called. Later this will invoke the Z91 Android SDK.", receipt);
    // Safe placeholder message
    alert("Z91 POS SDK print triggered (Placeholder Mode)");
    
    // Call existing print service to maintain compatibility
    const invoiceNumber = receipt?.invoiceNumber || (typeof receipt === "string" ? receipt : null);
    if (invoiceNumber) {
      await printSaleReceipt(invoiceNumber);
    }
  }
}

export function isRunningOnWeb(): boolean {
  if (typeof window === "undefined") return false;
  // If there's an Android interface injected (e.g. window.Android), it's the POS wrapper.
  return !(window as any).Android;
}

export function getPrintAdapter(): PrintAdapter {
  if (isRunningOnWeb()) {
    return new BrowserPrintAdapter();
  }
  return new PosPrintAdapter();
}

function renderThermalHtml(receipt: any, width: string): string {
  const is58 = width === "58mm";
  return `
    <div class="thermal-receipt ${is58 ? 'w-58' : 'w-80'}" style="font-family: monospace; font-size: ${is58 ? '10px' : '12px'}; line-height: 1.3; color: black; padding: 2mm; background: white;">
      <div style="text-align: center; margin-bottom: 8px;">
        <div style="font-size: 1.2rem; font-weight: bold; text-transform: uppercase;">${receipt.shop.name}</div>
        <div style="font-size: 0.8em; margin-top: 2px;">${receipt.shop.address}</div>
        <div style="font-size: 0.8em;">PH: ${receipt.shop.phone}</div>
        <div style="font-size: 0.8em;">GSTIN: ${receipt.shop.gstin}</div>
      </div>

      <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>

      <div style="font-size: 0.9em; line-height: 1.4;">
        <div><strong>INV:</strong> ${receipt.invoiceNumber}</div>
        <div><strong>DATE:</strong> ${receipt.date} ${receipt.time}</div>
        <div><strong>CASHIER:</strong> ${receipt.cashier}</div>
        <div><strong>CUSTOMER:</strong> ${receipt.customer.name}</div>
        ${receipt.customer.phone ? `<div><strong>PHONE:</strong> +91 ${receipt.customer.phone}</div>` : ''}
      </div>

      <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>

      <div style="font-size: 0.9em;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 1px dashed #000;">
              <th align="left" style="padding-bottom: 4px;">Item</th>
              <th align="right" style="padding-bottom: 4px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${receipt.items.map((item: any) => `
              <tr>
                <td style="padding: 2px 0; max-width: ${is58 ? '140px' : '200px'}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  ${item.qty}x ${item.name}
                </td>
                <td align="right" style="vertical-align: top; padding: 2px 0;">${inr(item.lineTotal)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>

      <div style="font-size: 0.95em;">
        <table style="width: 100%;">
          <tr>
            <td>Subtotal</td>
            <td align="right">${inr(receipt.subtotal)}</td>
          </tr>
          <tr>
            <td>Discount</td>
            <td align="right">-${inr(receipt.discount)}</td>
          </tr>
          <tr>
            <td>GST</td>
            <td align="right">${inr(receipt.gst)}</td>
          </tr>
          <tr style="font-weight: bold; font-size: 1.1em;">
            <td style="padding-top: 4px;">GRAND TOTAL</td>
            <td align="right" style="padding-top: 4px;">${inr(receipt.grandTotal)}</td>
          </tr>
        </table>
      </div>

      <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>

      <div style="text-align: center; font-size: 0.9em;">
        <div>Paid via ${receipt.paymentMethod}</div>
        ${receipt.paymentMethod === "UPI" && receipt.upiQrCode ? `
          <div style="margin-top: 8px; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 4px;">
            <img src="${receipt.upiQrCode}" style="width: 80px; height: 80px; display: block; margin: 0 auto;" />
            <span style="font-size: 0.8em;">Scan to pay via UPI</span>
          </div>
        ` : ''}
        <div style="margin-top: 8px; font-weight: bold;">
          ${receipt.thankYouMessage}
        </div>
      </div>
    </div>
  `;
}

function renderA4Html(receipt: any): string {
  return `
    <div class="a4-invoice" style="font-family: system-ui, -apple-system, sans-serif; color: #1e293b; padding: 20px; background: white; max-width: 800px; margin: 0 auto;">
      <!-- Invoice Header -->
      <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 20px;">
        <div>
          <h1 style="font-size: 28px; font-weight: 800; color: #0f172a; margin: 0 0 6px 0; text-transform: uppercase; letter-spacing: -0.5px;">${receipt.shop.name}</h1>
          <div style="font-size: 13px; color: #64748b; line-height: 1.5; max-width: 320px;">
            <div>${receipt.shop.address}</div>
            <div>PH: ${receipt.shop.phone}</div>
            <div>GSTIN: ${receipt.shop.gstin}</div>
          </div>
        </div>
        <div style="text-align: right;">
          <h2 style="font-size: 24px; font-weight: 700; color: #0f172a; margin: 0 0 8px 0; letter-spacing: 0.5px;">TAX INVOICE</h2>
          <div style="font-size: 13px; color: #64748b; line-height: 1.5;">
            <div><strong>Invoice No:</strong> ${receipt.invoiceNumber}</div>
            <div><strong>Date:</strong> ${receipt.date} ${receipt.time}</div>
            <div><strong>Cashier:</strong> ${receipt.cashier}</div>
          </div>
        </div>
      </div>

      <!-- Billing Details -->
      <div style="margin-bottom: 30px; display: flex; justify-content: space-between; font-size: 13px;">
        <div style="background: #f8fafc; border-radius: 12px; padding: 16px; width: 48%; border: 1px solid #e2e8f0;">
          <div style="font-weight: 700; color: #0f172a; margin-bottom: 8px; font-size: 11px; text-transform: uppercase; tracking-wider;">Bill To</div>
          <div style="font-weight: 600; font-size: 15px; color: #1e293b; margin-bottom: 4px;">${receipt.customer.name}</div>
          ${receipt.customer.phone ? `<div style="color: #64748b;">Phone: +91 ${receipt.customer.phone}</div>` : ''}
        </div>
        <div style="background: #f8fafc; border-radius: 12px; padding: 16px; width: 48%; border: 1px solid #e2e8f0; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div style="font-weight: 700; color: #0f172a; margin-bottom: 6px; font-size: 11px; text-transform: uppercase; tracking-wider;">Payment Information</div>
            <div style="font-size: 14px; font-weight: 600; color: #1e293b;">Method: ${receipt.paymentMethod}</div>
          </div>
          <div style="font-size: 12px; color: #059669; font-weight: bold; text-transform: uppercase; margin-top: 8px;">
            Status: PAID
          </div>
        </div>
      </div>

      <!-- Items Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 13px; text-align: left;">
        <thead>
          <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; color: #334155; font-weight: 700;">
            <th style="padding: 12px 10px; border-radius: 6px 0 0 6px;">#</th>
            <th style="padding: 12px 10px;">Item Description</th>
            <th style="padding: 12px 10px; text-align: right;">Unit Price</th>
            <th style="padding: 12px 10px; text-align: center;">Qty</th>
            <th style="padding: 12px 10px; text-align: right;">Discount</th>
            <th style="padding: 12px 10px; text-align: right;">GST</th>
            <th style="padding: 12px 10px; text-align: right; border-radius: 0 6px 6px 0;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${receipt.items.map((item: any, idx: number) => `
            <tr style="border-bottom: 1px solid #e2e8f0; color: #475569;">
              <td style="padding: 12px 10px;">${idx + 1}</td>
              <td style="padding: 12px 10px; font-weight: 600; color: #0f172a;">${item.name}</td>
              <td style="padding: 12px 10px; text-align: right;">${inr(item.price)}</td>
              <td style="padding: 12px 10px; text-align: center;">${item.qty}</td>
              <td style="padding: 12px 10px; text-align: right;">${item.discount > 0 ? `${(item.discount * 100).toFixed(0)}%` : '0%'}</td>
              <td style="padding: 12px 10px; text-align: right;">${item.gst}%</td>
              <td style="padding: 12px 10px; text-align: right; font-weight: 600; color: #0f172a;">${inr(item.lineTotal)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <!-- Summary and UPI -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; page-break-inside: avoid; break-inside: avoid;">
        <div style="width: 50%;">
          ${receipt.paymentMethod === "UPI" && receipt.upiQrCode ? `
            <div style="display: flex; align-items: center; gap: 16px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 14px; border-radius: 12px; max-width: 320px;">
              <img src="${receipt.upiQrCode}" style="width: 90px; height: 90px; border-radius: 6px; background: white; padding: 4px; border: 1px solid #cbd5e1;" />
              <div>
                <div style="font-weight: 700; font-size: 12px; color: #0f172a; text-transform: uppercase;">Scan to Pay</div>
                <div style="font-size: 11px; color: #64748b; margin-top: 4px; line-height: 1.3;">Pay securely using any UPI app (GPay, PhonePe, Paytm, BHIM)</div>
              </div>
            </div>
          ` : ''}
        </div>
        
        <div style="width: 45%;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #475569;">
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 0; text-align: left;">Subtotal</td>
              <td style="padding: 8px 0; text-align: right; font-weight: 600;">${inr(receipt.subtotal)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 0; text-align: left;">Discount</td>
              <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #b91c1c;">- ${inr(receipt.discount)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 0; text-align: left;">GST Tax</td>
              <td style="padding: 8px 0; text-align: right; font-weight: 600;">${inr(receipt.gst)}</td>
            </tr>
            <tr style="border-top: 2px solid #cbd5e1; font-size: 16px; color: #0f172a; font-weight: 800;">
              <td style="padding: 12px 0; text-align: left;">GRAND TOTAL</td>
              <td style="padding: 12px 0; text-align: right; color: #0f172a;">${inr(receipt.grandTotal)}</td>
            </tr>
          </table>
        </div>
      </div>

      <!-- Footer Notes -->
      <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center; font-size: 12px; color: #64748b;">
        <div style="font-weight: 700; color: #1e293b; margin-bottom: 4px;">${receipt.thankYouMessage}</div>
        <div>For queries regarding this invoice, please reach out to ${receipt.shop.phone} or hello@orionpos.in</div>
      </div>
    </div>
  `;
}
