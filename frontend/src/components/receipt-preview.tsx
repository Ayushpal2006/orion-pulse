import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ReceiptRenderer } from "./receipt-templates";

export function ReceiptPreview() {
  const shopName = useApp((s) => s.shopName);
  const gstin = useApp((s) => s.gstin);
  const storeAddress = useApp((s) => s.storeAddress);
  const storePhone = useApp((s) => s.storePhone);
  const receiptHeader = useApp((s) => s.receiptHeader);
  const receiptFooter = useApp((s) => s.receiptFooter);
  const upiId = useApp((s) => s.upiId);
  const qrPosition = useApp((s) => s.qrPosition);
  const paperWidth = useApp((s) => s.paperWidth);
  const logo = useApp((s) => s.logo);
  const receiptTemplate = useApp((s) => s.receiptTemplate);

  const receipt = {
    shop: {
      logo,
      name: shopName,
      address: storeAddress,
      phone: storePhone,
      gstin,
    },
    invoiceNumber: "INV-20260715-000021",
    date: "15 Jul 2026",
    time: "06:49 PM",
    cashier: "Admin",
    customer: {
      name: "Walk-in Customer",
    },
    items: [
      { name: "Cotton Tee", qty: 1, price: 499.00, discount: 0, gst: 0, lineTotal: 499.00 },
      { name: "Socks", qty: 2, price: 249.00, discount: 0, gst: 0, lineTotal: 498.00 },
    ],
    subtotal: 997.00,
    discount: 0.00,
    gst: 0.00,
    grandTotal: 997.00,
    paymentMethod: "UPI",
    upiPayload: `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(shopName)}&am=997.00&cu=INR`,
    thankYouMessage: receiptHeader, // receiptHeader is rendered under the header in classic, but in unified renderer it maps to thankYouMessage or custom header. Let's combine them or pass receiptFooter
  };

  // Adjust mock data fields mapping to standard structures
  const normReceipt = {
    ...receipt,
    thankYouMessage: receiptFooter || "Thank you for shopping with us",
  };

  return (
    <div
      className={cn(
        "mx-auto bg-white p-3 font-mono text-[10px] leading-relaxed text-black transition-all border border-neutral-200 shadow-sm",
        paperWidth === "58mm" ? "w-[220px]" : "w-[280px]",
      )}
    >
      <ReceiptRenderer
        receipt={normReceipt}
        template={receiptTemplate}
        paperWidth={paperWidth === "A4" ? "80mm" : paperWidth}
        qrPosition={qrPosition}
      />
    </div>
  );
}
