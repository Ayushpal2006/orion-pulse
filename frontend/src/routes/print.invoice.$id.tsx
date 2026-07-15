import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { getSaleReceipt } from "@/lib/api";
import { waitForReceiptResources } from "@/lib/print-adapter";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/print/invoice/$id")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      autoprint: (search.autoprint as string) || undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Print Receipt · Orion POS" },
      { name: "description", content: "Dedicated printable thermal receipt page." },
    ],
  }),
  component: PrintInvoicePage,
});

interface ThermalReceiptProps {
  receipt: any;
}

function ThermalReceipt({ receipt }: ThermalReceiptProps) {
  const formatInr = (val: number) => `Rs ${val.toFixed(2)}`;

  return (
    <div 
      className="thermal-receipt" 
      style={{
        width: "58mm",
        padding: "2mm",
        boxSizing: "border-box",
        background: "#ffffff",
        color: "#000000",
        fontFamily: "monospace",
        fontSize: "12px",
        lineHeight: "1.15",
      }}
    >
      {/* Shop Info Header */}
      <div style={{ textAlign: "center", marginBottom: "4px" }}>
        <div style={{ fontSize: "18px", fontWeight: "bold", textTransform: "uppercase", marginBottom: "1px" }}>
          {receipt.shop.name}
        </div>
        <div style={{ fontSize: "11px", marginBottom: "1px" }}>{receipt.shop.address}</div>
        <div style={{ fontSize: "11px" }}>PH: {receipt.shop.phone}</div>
        <div style={{ fontSize: "11px" }}>GSTIN: {receipt.shop.gstin}</div>
      </div>

      {/* Dashed Separator */}
      <div style={{ borderTop: "1px dashed #000000", margin: "4px 0" }}></div>

      {/* Invoice Info */}
      <div style={{ fontSize: "11px", lineHeight: "1.2" }}>
        <div><strong>INV:</strong> {receipt.invoiceNumber}</div>
        <div><strong>DATE:</strong> {receipt.date} {receipt.time}</div>
        <div><strong>CASHIER:</strong> {receipt.cashier}</div>
        <div><strong>CUSTOMER:</strong> {receipt.customer.name}</div>
        {receipt.customer.phone && <div><strong>PHONE:</strong> +91 {receipt.customer.phone}</div>}
      </div>

      {/* Dashed Separator */}
      <div style={{ borderTop: "1px dashed #000000", margin: "4px 0" }}></div>

      {/* Items List Table */}
      <table style={{ width: "100%", fontSize: "11px", borderCollapse: "collapse", margin: "2px 0" }}>
        <thead>
          <tr style={{ borderBottom: "1px dashed #000000" }}>
            <th align="left" style={{ paddingBottom: "2px", fontWeight: "bold" }}>Item</th>
            <th align="right" style={{ paddingBottom: "2px", fontWeight: "bold" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {receipt.items.map((item: any, idx: number) => (
            <tr key={idx}>
              <td style={{ padding: "2px 0", maxWidth: "130px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.qty}x {item.name}
              </td>
              <td align="right" style={{ padding: "2px 0", verticalAlign: "top" }}>
                {formatInr(item.lineTotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Dashed Separator */}
      <div style={{ borderTop: "1px dashed #000000", margin: "4px 0" }}></div>

      {/* Totals Summary */}
      <table style={{ width: "100%", fontSize: "11px", lineHeight: "1.2" }}>
        <tbody>
          <tr>
            <td>Subtotal</td>
            <td align="right">{formatInr(receipt.subtotal)}</td>
          </tr>
          <tr>
            <td>Discount</td>
            <td align="right">-{formatInr(receipt.discount)}</td>
          </tr>
          <tr>
            <td>GST Tax</td>
            <td align="right">{formatInr(receipt.gst)}</td>
          </tr>
          <tr style={{ fontWeight: "bold", fontSize: "14px" }}>
            <td style={{ paddingTop: "2px" }}>GRAND TOTAL</td>
            <td align="right" style={{ paddingTop: "2px" }}>{formatInr(receipt.grandTotal)}</td>
          </tr>
        </tbody>
      </table>

      {/* Dashed Separator */}
      <div style={{ borderTop: "1px dashed #000000", margin: "4px 0" }}></div>

      {/* Footer payment details & UPI QR */}
      <div style={{ textAlign: "center", fontSize: "11px" }}>
        <div>Paid via {receipt.paymentMethod}</div>
        {receipt.paymentMethod === "UPI" && receipt.upiQrCode && (
          <div style={{ marginTop: "4px", display: "block" }}>
            <img 
              src={receipt.upiQrCode} 
              style={{ width: "70px", height: "70px", display: "block", margin: "0 auto" }} 
              alt="UPI QR Code"
            />
            <span style={{ fontSize: "9px", color: "#666666" }}>Scan to pay via UPI</span>
          </div>
        )}
        <div style={{ marginTop: "6px", fontWeight: "bold", fontSize: "11px" }}>
          {receipt.thankYouMessage}
        </div>
      </div>
    </div>
  );
}

function PrintInvoicePage() {
  const { id } = Route.useParams();
  const { autoprint } = Route.useSearch();
  const [isReady, setIsReady] = useState(false);

  const { data: receipt, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["receipt", id],
    queryFn: () => getSaleReceipt(id),
    staleTime: 5000,
    retry: 1,
  });

  // Inject print-page class helper to body
  useEffect(() => {
    document.body.classList.add("print-page");
    return () => {
      document.body.classList.remove("print-page");
    };
  }, []);

  // Wait for images and fonts to finish layout rendering
  useEffect(() => {
    if (!receipt) return;

    let active = true;
    const loadAndPrep = async () => {
      // Delay slightly to let React complete its render pass on the DOM
      await new Promise<void>((resolve) => setTimeout(resolve, 100));

      const el = document.getElementById("orion-print-section");
      if (el && active) {
        try {
          await waitForReceiptResources(el);
        } catch (e) {
          console.error("Resource wait failed:", e);
        }
        if (active) {
          setIsReady(true);
        }
      }
    };

    loadAndPrep();
    return () => {
      active = false;
    };
  }, [receipt]);

  // Handle printing and window auto-closing
  useEffect(() => {
    if (isReady && autoprint !== "false") {
      // Ensure print inject styles exist
      let styleEl = document.getElementById("orion-print-style-inject") as HTMLStyleElement;
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "orion-print-style-inject";
        document.head.appendChild(styleEl);
      }
      styleEl.innerHTML = `@media print { @page { size: 58mm auto; margin: 0; } }`;

      const handleAfterPrint = () => {
        window.close();
      };

      // Add listener to close the window once the spooler takes the copy or completes
      window.addEventListener("afterprint", handleAfterPrint);

      window.print();

      // Safe fallback timer to close the window if the spooler doesn't fire afterprint
      const fallbackTimer = setTimeout(() => {
        window.close();
      }, 2000);

      return () => {
        window.removeEventListener("afterprint", handleAfterPrint);
        clearTimeout(fallbackTimer);
      };
    }
  }, [isReady, autoprint]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-white print:hidden">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="mt-2 text-sm text-muted-foreground">Loading receipt details...</span>
      </div>
    );
  }

  if (isError || !receipt) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center p-4 text-center bg-white print:hidden">
        <h1 className="text-lg font-bold text-destructive">Failed to load invoice</h1>
        <p className="mt-2 text-sm text-neutral-500">
          {error?.message || "Could not retrieve the requested invoice data."}
        </p>
        <div className="mt-6 flex gap-2 justify-center">
          <Button onClick={() => refetch()} className="rounded-xl h-10 px-4">
            🔄 Retry
          </Button>
          <Button variant="outline" onClick={() => window.history.back()} className="rounded-xl h-10 px-4">
            👈 Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-neutral-100 print:bg-white print:p-0">
      {/* On-screen controls, hidden during print */}
      <div className="mx-auto mb-6 flex max-w-[58mm] justify-between gap-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 shadow-sm print:hidden">
        <div className="flex flex-col justify-center">
          <span className="text-[10px] font-bold text-neutral-500 uppercase">POS Printing</span>
          <span className="text-xs font-semibold font-mono">{receipt.invoiceNumber}</span>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => window.print()} className="rounded-xl h-8 text-[11px] px-2.5">
            Print
          </Button>
          <Button variant="outline" onClick={() => window.history.back()} className="rounded-xl h-8 text-[11px] px-2.5">
            Back
          </Button>
        </div>
      </div>

      {/* Print template container */}
      <div id="orion-print-section">
        <ThermalReceipt receipt={receipt} />
      </div>
    </div>
  );
}
