import { settingsRepository } from "../repositories";

export class InvoiceService {
  private cache = new Map<string, string>();

  getFromCache(token: string): string | undefined {
    return this.cache.get(token);
  }

  setToCache(token: string, html: string): void {
    this.cache.set(token, html);
  }

  invalidate(token: string): void {
    this.cache.delete(token);
  }

  async generateHtmlInvoice(receipt: any): Promise<string> {
    const signature = await settingsRepository.get("signature", "Authorized Signatory");
    const exchangePolicy = await settingsRepository.get("exchange_policy", "Items can be exchanged within 7 days in original condition.");
    const theme = await settingsRepository.get("invoice_theme", "classic");
    
    // Website, Instagram, Maps links from settings
    const website = await settingsRepository.get("business_website", "https://orionpos.in");
    const instagram = await settingsRepository.get("instagram_url", "https://instagram.com/orionpos");
    const maps = await settingsRepository.get("maps_url", "https://maps.google.com");

    let primaryColor = "from-slate-900 to-slate-800 text-slate-950";
    let accentBtn = "bg-slate-900 text-white hover:bg-slate-800";
    if (theme === "clean") {
      primaryColor = "from-blue-700 to-blue-600 text-blue-950";
      accentBtn = "bg-blue-600 text-white hover:bg-blue-700";
    } else if (theme === "dark") {
      primaryColor = "from-neutral-900 to-neutral-850 text-neutral-950";
      accentBtn = "bg-neutral-900 text-white hover:bg-neutral-800";
    }

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex,nofollow">
  <title>Invoice ${receipt.invoiceNumber} - ${receipt.shop.name}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
    body { font-family: 'Outfit', sans-serif; }
  </style>
</head>
<body class="bg-neutral-50 text-neutral-800 p-2 sm:p-6 md:p-8">
  <div class="max-w-3xl mx-auto bg-white rounded-3xl border border-neutral-100 shadow-xl overflow-hidden">
    
    <!-- Top Gradient Accent -->
    <div class="h-3 bg-gradient-to-r ${primaryColor}"></div>

    <div class="p-6 sm:p-10 space-y-8">
      
      <!-- Top Action Buttons -->
      <div class="flex justify-between items-center pb-4 border-b border-neutral-100">
        <span class="text-xs text-neutral-400 font-medium">PUBLIC SECURED INVOICE VIEW</span>
        <div class="flex gap-2">
          <a href="/invoice/v/${receipt.publicToken}/download" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${accentBtn} transition-colors shadow-sm">
            <svg class="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            Download A4 PDF
          </a>
        </div>
      </div>

      <!-- Header -->
      <div class="flex flex-col md:flex-row justify-between items-start gap-6">
        <div class="space-y-2">
          <div class="flex items-center gap-2">
            ${receipt.shop.logo ? `<img src="${receipt.shop.logo}" class="h-12 object-contain mr-1" alt="Logo">` : `<span class="text-2xl">🏬</span>`}
            <h1 class="text-3xl font-extrabold tracking-tight text-neutral-900">${receipt.shop.name}</h1>
          </div>
          <p class="text-sm text-neutral-500 max-w-sm leading-relaxed">${receipt.shop.address}</p>
          <div class="text-xs text-neutral-400 space-y-0.5">
            <p>Phone: ${receipt.shop.phone} | Email: ${receipt.shop.email || "Support_Technician"}</p>
            <p>GSTIN: <span class="font-mono">${receipt.shop.gstin}</span></p>
          </div>
        </div>
        <div class="text-right flex flex-col items-start md:items-end gap-1">
          <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
            <span class="size-1.5 rounded-full bg-emerald-500"></span> PAID
          </span>
          <span class="text-xs text-neutral-400 mt-2">Invoice Reference</span>
          <span class="font-mono text-sm font-semibold text-neutral-900">${receipt.invoiceNumber}</span>
        </div>
      </div>

      <hr class="border-neutral-100">

      <!-- Meta Info -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 bg-neutral-50/50 p-6 rounded-2xl border border-neutral-100">
        <div class="space-y-1">
          <span class="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Bill To</span>
          <h3 class="text-base font-bold text-neutral-900">${receipt.customer.name}</h3>
          ${receipt.customer.phone ? `<p class="text-sm text-neutral-500">Phone: +91 ${receipt.customer.phone}</p>` : ""}
        </div>
        <div class="space-y-1">
          <span class="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Billing Details</span>
          <p class="text-sm text-neutral-700"><span class="text-neutral-400">Date:</span> ${receipt.date} ${receipt.time}</p>
          <p class="text-sm text-neutral-700"><span class="text-neutral-400">Cashier:</span> ${receipt.cashier}</p>
        </div>
      </div>

      <!-- Items Grid -->
      <div class="space-y-3">
        <h4 class="text-xs font-bold tracking-wider text-neutral-400 uppercase">Purchase Summary</h4>
        <div class="border border-neutral-100 rounded-2xl overflow-hidden">
          <table class="w-full text-left border-collapse text-sm">
            <thead>
              <tr class="bg-neutral-50 border-b border-neutral-100 text-neutral-500 text-xs font-semibold">
                <th class="p-4">Item details</th>
                <th class="p-4 text-right">Qty</th>
                <th class="p-4 text-right">Price</th>
                <th class="p-4 text-right">GST</th>
                <th class="p-4 text-right">Total</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-neutral-50">
              ${receipt.items.map((item: { name: string; qty: number; price: number; gst?: number; lineTotal: number }) => `
                <tr class="text-neutral-700 hover:bg-neutral-50/40 transition-colors">
                  <td class="p-4 font-semibold text-neutral-900">${item.name}</td>
                  <td class="p-4 text-right tabular-nums">${item.qty}</td>
                  <td class="p-4 text-right tabular-nums">₹${item.price.toFixed(2)}</td>
                  <td class="p-4 text-right text-neutral-400 text-xs">${item.gst}%</td>
                  <td class="p-4 text-right font-bold text-neutral-900 tabular-nums">₹${item.lineTotal.toFixed(2)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Totals Breakdown -->
      <div class="flex flex-col md:flex-row justify-between items-start gap-8 pt-4">
        <div class="space-y-4">
          <div class="space-y-1">
            <span class="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Payment Summary</span>
            <p class="text-sm font-semibold text-neutral-900">${receipt.paymentMethod} Payment Mode</p>
          </div>
          ${receipt.paymentMethod === "UPI" ? `
            <div class="flex items-center gap-3 bg-neutral-50 p-3 rounded-xl border border-neutral-100 max-w-xs">
              <div class="size-16 bg-white border border-neutral-200 rounded p-1 flex-shrink-0 flex items-center justify-center">
                ${receipt.upiQrCode ? `<img src="${receipt.upiQrCode}" class="size-full object-contain" alt="UPI QR">` : `<span class="text-xs text-neutral-400 font-mono">[QR]</span>`}
              </div>
              <div class="text-[10px] text-neutral-500 leading-tight">
                UPI ID: ${receipt.shop.upiId}<br>
                Reference verified at checkout transaction logs.
              </div>
            </div>
          ` : ""}
        </div>
        <div class="w-full md:w-80 space-y-3 bg-neutral-50 p-6 rounded-2xl border border-neutral-100 text-sm">
          <div class="flex justify-between text-neutral-500">
            <span>Subtotal</span>
            <span class="font-semibold text-neutral-700">₹${receipt.subtotal.toFixed(2)}</span>
          </div>
          <div class="flex justify-between text-neutral-500">
            <span>Discount</span>
            <span class="font-semibold text-rose-600">-₹${receipt.discount.toFixed(2)}</span>
          </div>
          <div class="flex justify-between text-neutral-500">
            <span>Tax GST</span>
            <span class="font-semibold text-neutral-700">₹${receipt.gst.toFixed(2)}</span>
          </div>
          <div class="border-t border-neutral-200 my-2"></div>
          <div class="flex justify-between font-extrabold text-neutral-900 text-lg">
            <span>Grand Total</span>
            <span class="text-xl">₹${receipt.grandTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <hr class="border-neutral-100">

      <!-- Bottom Policies and Signature -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
        <div class="space-y-2">
          <span class="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Exchange Policy</span>
          <p class="text-xs text-neutral-500 leading-relaxed">${exchangePolicy}</p>
          <div class="flex gap-3 text-xs text-neutral-400 pt-2">
            <a href="${website}" target="_blank" class="hover:underline">Website</a>
            <a href="${instagram}" target="_blank" class="hover:underline">Instagram</a>
            <a href="${maps}" target="_blank" class="hover:underline">Maps</a>
          </div>
        </div>
        <div class="flex flex-col items-center md:items-end justify-center">
          <div class="w-full max-w-[200px] text-center">
            <div class="border-b border-neutral-200 pb-1 text-xs font-mono text-neutral-400 min-h-[40px] flex items-end justify-center">
              ${signature}
            </div>
            <p class="text-[10px] text-neutral-400 mt-1 uppercase font-bold tracking-wider">Authorized Signatory</p>
          </div>
        </div>
      </div>

      <!-- Footer Message -->
      <div class="pt-6 text-center space-y-1">
        <p class="text-sm font-extrabold text-neutral-700">${receipt.thankYouMessage}</p>
        <p class="text-[10px] text-neutral-400">Thank you for visiting ${receipt.shop.name}! Visit again soon.</p>
      </div>

    </div>
  </div>
</body>
</html>
    `;
  }
}
