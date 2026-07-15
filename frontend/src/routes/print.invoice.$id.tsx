import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { getSaleReceipt } from "@/lib/api";
import { useApp } from "@/lib/store";
import { renderThermalHtml, renderA4Html, waitForReceiptResources } from "@/lib/print-adapter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/print/invoice/$id")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      paper: (search.paper as string) || undefined,
      autoprint: (search.autoprint as string) || undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Print Receipt · Orion POS" },
      { name: "description", content: "Dedicated printable invoice page." },
    ],
  }),
  component: PrintInvoicePage,
});

function PrintInvoicePage() {
  const { id } = Route.useParams();
  const { paper, autoprint } = Route.useSearch();
  const storePaperWidth = useApp((s) => s.paperWidth);
  const activePaperWidth = paper || storePaperWidth;
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

  // Handle auto-printing once assets are ready
  useEffect(() => {
    if (isReady && autoprint !== "false") {
      // Set page styles dynamically for page size
      let styleEl = document.getElementById("orion-print-style-inject") as HTMLStyleElement;
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "orion-print-style-inject";
        document.head.appendChild(styleEl);
      }

      if (activePaperWidth === "58mm") {
        styleEl.innerHTML = `@media print { @page { size: 58mm auto; margin: 0; } }`;
      } else if (activePaperWidth === "80mm") {
        styleEl.innerHTML = `@media print { @page { size: 80mm auto; margin: 0; } }`;
      } else {
        styleEl.innerHTML = `@media print { @page { size: A4; margin: 15mm; } }`;
      }

      window.print();
    }
  }, [isReady, autoprint, activePaperWidth]);

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

  const html = activePaperWidth === "A4" 
    ? renderA4Html(receipt) 
    : renderThermalHtml(receipt, activePaperWidth);

  return (
    <div className="min-h-screen bg-white text-black p-4 md:p-8">
      {/* On-screen controls, hidden during print */}
      <div className="mx-auto mb-6 flex max-w-md justify-between gap-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 shadow-sm print:hidden">
        <div className="flex flex-col justify-center">
          <span className="text-xs font-bold text-neutral-500 uppercase">Printing Invoice</span>
          <span className="text-sm font-semibold font-mono">{receipt.invoiceNumber}</span>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => window.print()} className="rounded-xl h-9 text-xs">
            🖨️ Print Again
          </Button>
          <Button variant="outline" onClick={() => window.history.back()} className="rounded-xl h-9 text-xs">
            👈 Back
          </Button>
        </div>
      </div>

      {/* Print template container */}
      <div 
        id="orion-print-section"
        className={cn(
          "mx-auto shadow-inner border border-neutral-100 rounded-lg p-2 print:border-none print:shadow-none print:p-0 bg-white",
          activePaperWidth === "58mm" && "print-58mm",
          activePaperWidth === "80mm" && "print-80mm",
          activePaperWidth === "A4" && "print-a4"
        )}
        style={{ 
          width: activePaperWidth === "58mm" ? "58mm" : activePaperWidth === "80mm" ? "80mm" : "100%",
          maxWidth: activePaperWidth === "58mm" ? "58mm" : activePaperWidth === "80mm" ? "80mm" : "800px",
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
