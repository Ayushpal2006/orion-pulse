import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2, Printer, ArrowLeft } from "lucide-react";
import { getPurchaseById, API_BASE_URL, apiFetch } from "@/lib/api";
import { waitForReceiptResources } from "@/lib/print-adapter";
import { Button } from "@/components/ui/button";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/print/purchase/$id")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      autoprint: (search.autoprint as string) || undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Print Purchase Order · Orion POS" },
      { name: "description", content: "Printable Purchase Order receipt page." },
    ],
  }),
  component: PrintPurchasePage,
});

function PrintPurchasePage() {
  const { id } = Route.useParams();
  const { autoprint } = Route.useSearch();
  const [isReady, setIsReady] = useState(false);

  // Mount log
  useEffect(() => {
    document.body.classList.add("print-page");
    return () => {
      document.body.classList.remove("print-page");
    };
  }, []);

  // Fetch purchase details
  const { data: purchase, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["purchase-print", id],
    queryFn: () => getPurchaseById(id),
    staleTime: 5000,
    retry: 1,
  });

  // Fetch settings details
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await apiFetch(`${API_BASE_URL}/settings`);
      const json = await res.json();
      return json.success ? json.data : {};
    },
    staleTime: 30000,
  });

  const paperWidth = settings?.paper_width || "A4";

  // Wait for layout rendering
  useEffect(() => {
    if (!purchase) return;

    let active = true;
    const loadAndPrep = async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 100));

      const el = document.getElementById("orion-purchase-print-section");
      if (el && active) {
        try {
          await waitForReceiptResources(el);
        } catch (e) {
          console.error("Resource wait failed:", e);
        }
        await new Promise<void>((resolve) => setTimeout(resolve, 200));
        if (active) {
          setIsReady(true);
        }
      }
    };

    loadAndPrep();
    return () => {
      active = false;
    };
  }, [purchase]);

  // Handle auto printing
  useEffect(() => {
    if (isReady && autoprint !== "false") {
      let styleEl = document.getElementById("orion-print-style-inject") as HTMLStyleElement;
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "orion-print-style-inject";
        document.head.appendChild(styleEl);
      }
      
      styleEl.innerHTML = `@media print { @page { size: A4 portrait; margin: 10mm; } }`;

      const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);
      const handleAfterPrint = () => {
        if (!isMobile) {
          window.close();
        }
      };

      window.addEventListener("afterprint", handleAfterPrint);
      window.print();

      if (!isMobile) {
        const fallbackTimer = setTimeout(() => {
          window.close();
        }, 3000);

        return () => {
          window.removeEventListener("afterprint", handleAfterPrint);
          clearTimeout(fallbackTimer);
        };
      }

      return () => {
        window.removeEventListener("afterprint", handleAfterPrint);
      };
    }
  }, [isReady, autoprint]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-white print:hidden">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="mt-2 text-sm text-muted-foreground">Loading purchase receipt...</span>
      </div>
    );
  }

  if (isError || !purchase) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center p-4 text-center bg-white print:hidden">
        <h1 className="text-lg font-bold text-destructive">Failed to load purchase order</h1>
        <p className="mt-2 text-sm text-neutral-500">
          {error?.message || "Could not retrieve the requested purchase order data."}
        </p>
        <div className="mt-6 flex gap-2 justify-center">
          <Button onClick={() => refetch()} className="rounded-xl h-10 px-4">
            Retry
          </Button>
          <Button variant="outline" onClick={() => window.history.back()} className="rounded-xl h-10 px-4">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const poNumber = purchase.po_number || purchase.purchase_number || `PO-#${purchase.id}`;
  const supplierInvoice = purchase.invoice_number || purchase.supplier_invoice_number || "N/A";
  const items = purchase.items || [];
  const status = purchase.status || "COMPLETED";

  return (
    <div className="min-h-screen p-4 md:p-8 bg-neutral-100 print:bg-white print:p-0">
      {/* On-screen controls, hidden during print */}
      <div className="mx-auto mb-6 flex max-w-2xl justify-between gap-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 shadow-sm print:hidden">
        <div className="flex flex-col justify-center">
          <span className="text-[10px] font-bold text-neutral-500 uppercase">Purchase Printing</span>
          <span className="text-xs font-semibold font-mono">{poNumber}</span>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => window.print()} className="rounded-xl h-8 text-[11px] px-3 gap-1.5">
            <Printer className="size-3.5" /> Print
          </Button>
          <Button variant="outline" onClick={() => window.history.back()} className="rounded-xl h-8 text-[11px] px-3 gap-1.5">
            <ArrowLeft className="size-3.5" /> Back
          </Button>
        </div>
      </div>

      {/* Printable A4 Purchase Voucher */}
      <div id="orion-purchase-print-section" className="mx-auto max-w-2xl bg-white p-8 rounded-2xl border border-neutral-200 shadow-sm print:shadow-none print:border-none print:p-0">
        <div className="flex justify-between items-start border-b border-neutral-200 pb-4">
          <div>
            <h1 className="text-xl font-bold text-neutral-900 uppercase tracking-tight">Purchase Voucher</h1>
            <div className="text-xs text-neutral-500 font-mono mt-0.5">PO Number: {poNumber}</div>
            <div className="text-xs text-neutral-500 font-mono">Supplier Inv #: {supplierInvoice}</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold text-neutral-700">Date: {new Date(purchase.purchase_date || purchase.created_at).toLocaleDateString("en-IN")}</div>
            <div className="text-xs text-neutral-500">Status: <span className="font-bold text-neutral-800">{status}</span></div>
            <div className="text-xs text-neutral-500">Payment: <span className="font-semibold">{purchase.payment_status || "Paid"} ({purchase.payment_method || "Cash"})</span></div>
          </div>
        </div>

        {/* Supplier details */}
        <div className="my-4 p-3 bg-neutral-50 rounded-xl text-xs space-y-1">
          <div className="font-bold uppercase text-[10px] text-neutral-500">Supplier Information</div>
          <div className="font-semibold text-neutral-900 text-sm">{purchase.supplier_name || "N/A"}</div>
          {purchase.supplier_phone && <div className="text-neutral-600">Phone: {purchase.supplier_phone}</div>}
          {purchase.supplier_gstin && <div className="text-neutral-600">GSTIN: {purchase.supplier_gstin}</div>}
        </div>

        {/* Line Items Table */}
        <table className="w-full text-xs text-left border-collapse my-4">
          <thead>
            <tr className="border-b border-neutral-300 bg-neutral-100 text-[10px] uppercase font-bold text-neutral-600">
              <th className="p-2">#</th>
              <th className="p-2">Product Description</th>
              <th className="p-2 text-center">Qty</th>
              <th className="p-2 text-right">Purchase Cost</th>
              <th className="p-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {items.map((item: any, idx: number) => {
              const pPrice = item.purchase_price ? item.purchase_price / 100.0 : 0;
              const lTotal = item.line_total ? item.line_total / 100.0 : pPrice * item.quantity;
              return (
                <tr key={idx}>
                  <td className="p-2 font-mono text-neutral-400">{idx + 1}</td>
                  <td className="p-2 font-semibold text-neutral-800">
                    {item.product_name || `Product #${item.product_id}`}
                    {item.product_sku && <span className="text-[10px] text-neutral-400 font-mono ml-1">({item.product_sku})</span>}
                  </td>
                  <td className="p-2 text-center font-mono font-bold">{item.quantity}</td>
                  <td className="p-2 text-right font-mono text-neutral-600">{inr(pPrice)}</td>
                  <td className="p-2 text-right font-mono font-bold text-neutral-900">{inr(lTotal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex flex-col items-end gap-1 border-t border-neutral-300 pt-3 text-xs">
          <div className="flex justify-between w-48 text-neutral-600">
            <span>Subtotal:</span>
            <span className="font-mono font-semibold text-neutral-900">{inr((purchase.subtotal || 0) / 100.0)}</span>
          </div>
          {purchase.discount > 0 && (
            <div className="flex justify-between w-48 text-neutral-600">
              <span>Discount:</span>
              <span className="font-mono font-semibold text-rose-600">-{inr((purchase.discount || 0) / 100.0)}</span>
            </div>
          )}
          {purchase.gst > 0 && (
            <div className="flex justify-between w-48 text-neutral-600">
              <span>GST Tax:</span>
              <span className="font-mono font-semibold text-neutral-900">+{inr((purchase.gst || 0) / 100.0)}</span>
            </div>
          )}
          <div className="flex justify-between w-48 text-sm font-bold border-t border-dashed border-neutral-300 pt-2 text-neutral-900">
            <span>Grand Total:</span>
            <span className="font-mono">{inr((purchase.grand_total || 0) / 100.0)}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-neutral-200 text-center text-[10px] text-neutral-400">
          Generated automatically via Orion POS Purchase Management.
        </div>
      </div>
    </div>
  );
}
