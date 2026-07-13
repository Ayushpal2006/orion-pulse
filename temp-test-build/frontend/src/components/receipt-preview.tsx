import { QRCodeSVG } from "qrcode.react";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";

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

  const upi = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(shopName)}&am=499.00&cu=INR`;

  const qr = (
    <div className="flex flex-col items-center gap-1 py-2">
      <div className="rounded bg-white p-1.5">
        <QRCodeSVG value={upi} size={72} />
      </div>
      <div className="text-[9px] text-muted-foreground">Scan to pay via UPI</div>
    </div>
  );

  return (
    <div
      className={cn(
        "mx-auto rounded-2xl border border-dashed border-border bg-white p-4 font-mono text-[11px] leading-relaxed text-black shadow-sm transition-all",
        paperWidth === "58mm" ? "w-[220px]" : "w-[280px]",
      )}
    >
      <div className="text-center">
        {logo && (
          <img src={logo} alt="" className="mx-auto mb-2 h-10 w-10 rounded object-contain" />
        )}
        <div className="text-[12px] font-bold uppercase tracking-wider">{shopName}</div>
        <div className="text-[9px] text-neutral-500">{storeAddress}</div>
        <div className="text-[9px] text-neutral-500">{storePhone}</div>
        <div className="text-[9px] text-neutral-500">GSTIN {gstin}</div>
      </div>
      <div className="my-2 border-t border-dashed border-neutral-300" />
      <div className="text-center text-[10px]">{receiptHeader}</div>
      <div className="my-2 border-t border-dashed border-neutral-300" />
      {qrPosition === "Top" && qr}
      <div className="space-y-0.5">
        <div className="flex justify-between"><span>1× Cotton Tee</span><span>499.00</span></div>
        <div className="flex justify-between"><span>2× Socks</span><span>498.00</span></div>
      </div>
      <div className="my-2 border-t border-dashed border-neutral-300" />
      <div className="flex justify-between font-bold"><span>TOTAL</span><span>997.00</span></div>
      {qrPosition === "Bottom" && qr}
      <div className="mt-2 text-center text-[9px] text-neutral-500">{receiptFooter}</div>
    </div>
  );
}
