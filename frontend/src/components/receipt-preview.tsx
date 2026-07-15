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

  const upi = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(shopName)}&am=997.00&cu=INR`;

  const qr = (
    <div className="flex flex-col items-center gap-1.5 py-2">
      <div className="bg-white p-2 border border-neutral-200 inline-block">
        <QRCodeSVG value={upi} size={130} />
      </div>
      <div className="text-[8px] font-bold text-neutral-600">Scan to Pay via UPI</div>
    </div>
  );

  return (
    <div
      className={cn(
        "mx-auto bg-white p-3 font-mono text-[10px] leading-relaxed text-black transition-all border border-neutral-200",
        paperWidth === "58mm" ? "w-[220px]" : "w-[280px]",
      )}
    >
      <div className="flex flex-col items-center text-center">
        {logo && (
          <img src={logo} alt="" className="mb-1.5 max-h-9 object-contain" />
        )}
        <div className="text-[12px] font-bold uppercase tracking-wider leading-none mb-1">{shopName}</div>
        <div className="text-[9px] text-neutral-600 leading-tight">{storeAddress}</div>
        <div className="text-[9px] text-neutral-600">PH: {storePhone}</div>
        <div className="text-[9px] text-neutral-600">GSTIN: {gstin}</div>
      </div>
      
      <div className="my-2 border-t border-dashed border-black" />
      <div className="text-center text-[9px] leading-normal">{receiptHeader}</div>
      <div className="my-2 border-t border-dashed border-black" />
      
      <div className="text-left leading-normal space-y-0.5 my-1.5">
        <div><strong>INV  :</strong> INV-20260715-000021</div>
        <div><strong>DATE :</strong> 15 Jul 2026</div>
        <div><strong>TIME :</strong> 06:49 PM</div>
        <div><strong>CASH :</strong> Admin</div>
        <div><strong>CUST :</strong> Walk-in Customer</div>
      </div>
      
      <div className="my-2 border-t border-dashed border-black" />
      
      {qrPosition === "Top" && qr}
      
      <table className="w-full text-[9px] border-collapse my-1">
        <thead>
          <tr className="border-b border-dashed border-black">
            <th align="left" className="pb-1 font-bold">Item</th>
            <th align="right" className="pb-1 font-bold">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr className="align-top">
            <td className="py-1 text-left pr-1">1x Cotton Tee</td>
            <td align="right" className="py-1 text-right whitespace-nowrap">₹499.00</td>
          </tr>
          <tr className="align-top">
            <td className="py-1 text-left pr-1">2x Socks</td>
            <td align="right" className="py-1 text-right whitespace-nowrap">₹498.00</td>
          </tr>
        </tbody>
      </table>
      
      <div className="my-2 border-t border-dashed border-black" />
      
      <table className="w-full text-[9px] leading-normal my-1">
        <tbody>
          <tr>
            <td className="text-left py-0.5">Subtotal</td>
            <td align="right" className="text-right py-0.5">₹997.00</td>
          </tr>
          <tr>
            <td className="text-left py-0.5">Discount</td>
            <td align="right" className="text-right py-0.5">-₹0.00</td>
          </tr>
          <tr>
            <td className="text-left py-0.5">GST Tax</td>
            <td align="right" className="text-right py-0.5">₹0.00</td>
          </tr>
          <tr className="font-bold text-[12px]">
            <td className="text-left pt-1">GRAND TOTAL</td>
            <td align="right" className="text-right pt-1">₹997.00</td>
          </tr>
        </tbody>
      </table>
      
      <div className="my-2 border-t border-dashed border-black" />
      
      <div className="flex flex-col items-center text-center space-y-1 my-1">
        <div className="font-bold">Paid via UPI</div>
        {qrPosition === "Bottom" && qr}
        <div className="mt-1 font-bold text-[9px] whitespace-pre-line leading-normal">{receiptFooter}</div>
      </div>
    </div>
  );
}
