import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { getSaleReceipt, API_BASE_URL } from "@/lib/api";
import { waitForReceiptResources } from "@/lib/print-adapter";
import { Button } from "@/components/ui/button";
import { ReceiptRenderer } from "@/components/receipt-templates";

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
  template: "Classic" | "Retail" | "Premium" | "Compact";
  paperWidth: "58mm" | "80mm";
  qrPosition: "Top" | "Bottom";
}

function ThermalReceipt({ receipt, template, paperWidth, qrPosition }: ThermalReceiptProps) {
  useEffect(() => {
    console.log("PRINT STEP 4: Receipt component mounted");
  }, []);

  console.log("PRINT STEP 5: Receipt rendered");
  if (receipt.paymentMethod === "UPI" && receipt.upiQrCode) {
    console.log("PRINT STEP 7: QR rendered");
  }
  console.log("PRINT STEP 8: Barcode rendered (No barcode required for this receipt layout)");

  return (
    <div 
      className="thermal-receipt" 
      style={{
        width: paperWidth === "80mm" ? "80mm" : "58mm",
        padding: "2mm 2mm 8mm 2mm",
        boxSizing: "border-box",
        background: "#ffffff",
        color: "#000000",
        fontFamily: "monospace",
        fontSize: "11px",
        lineHeight: "1.2",
        margin: "0 auto",
      }}
    >
      <ReceiptRenderer
        receipt={receipt}
        template={template}
        paperWidth={paperWidth}
        qrPosition={qrPosition}
      />
    </div>
  );
}

function PrintInvoicePage() {
  const { id } = Route.useParams();
  const { autoprint } = Route.useSearch();
  const [isReady, setIsReady] = useState(false);

  // Mount log
  useEffect(() => {
    console.log("PRINT STEP 2: Navigated to print page");
    document.body.classList.add("print-page");
    return () => {
      document.body.classList.remove("print-page");
    };
  }, []);

  // Fetch receipt details
  const { data: receipt, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["receipt", id],
    queryFn: () => getSaleReceipt(id),
    staleTime: 5000,
    retry: 1,
  });

  // Fetch settings details to load configured template automatically
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/settings`);
      const json = await res.json();
      return json.success ? json.data : {};
    },
    staleTime: 30000,
  });

  const template = settings?.receipt_template || "Classic";
  const qrPosition = settings?.qr_position || "Bottom";
  const paperWidth = settings?.paper_width || "58mm";

  // Fetch complete log
  useEffect(() => {
    if (receipt) {
      console.log("PRINT STEP 3: Invoice fetched", receipt.invoiceNumber);
    }
  }, [receipt]);

  // Wait for images and fonts to finish layout rendering
  useEffect(() => {
    if (!receipt) return;

    let active = true;
    const loadAndPrep = async () => {
      // 1. Wait for DOM nodes to be fully created
      await new Promise<void>((resolve) => setTimeout(resolve, 100));

      // 2. If UPI payment, wait for QR code image to exist in DOM
      if (receipt.paymentMethod === "UPI" && receipt.upiQrCode) {
        console.log("Waiting for UPI QR image to mount in DOM...");
        let attempts = 0;
        while (active && attempts < 20) {
          const qrImg = document.querySelector("#orion-print-section img");
          if (qrImg) break;
          await new Promise<void>((resolve) => setTimeout(resolve, 50));
          attempts++;
        }
      }

      const el = document.getElementById("orion-print-section");
      if (el && active) {
        try {
          await waitForReceiptResources(el);
          console.log("PRINT STEP 6: Images and resources loaded");
        } catch (e) {
          console.error("Resource wait failed:", e);
        }
        
        // Final additional safety delay for Android WebViews to parse fonts and layout
        await new Promise<void>((resolve) => setTimeout(resolve, 300));
        
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
      console.log("PRINT STEP 9: window.print() called");

      // Ensure print inject styles exist
      let styleEl = document.getElementById("orion-print-style-inject") as HTMLStyleElement;
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "orion-print-style-inject";
        document.head.appendChild(styleEl);
      }
      
      const sizeValue = paperWidth === "80mm" ? "80mm auto" : paperWidth === "A4" ? "A4 portrait" : "58mm auto";
      styleEl.innerHTML = `@media print { @page { size: ${sizeValue}; margin: 0; } }`;

      const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);

      const handleAfterPrint = () => {
        console.log("PRINT STEP 10: afterprint event fired");
        if (!isMobile) {
          window.close();
        } else {
          console.log("Running on mobile client: preventing auto window.close() to preserve spooler rendering context.");
        }
      };

      // Add listener to close the window once the spooler takes the copy or completes
      window.addEventListener("afterprint", handleAfterPrint);

      window.print();

      // Safe fallback timer to close the window (Desktop only)
      if (!isMobile) {
        const fallbackTimer = setTimeout(() => {
          console.log("Fallback window.close() fired (Desktop only)");
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
  }, [isReady, autoprint, paperWidth]);

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
        <ThermalReceipt 
          receipt={receipt} 
          template={template as any}
          paperWidth={(paperWidth === "A4" ? "80mm" : paperWidth) as any}
          qrPosition={qrPosition as any}
        />
      </div>
    </div>
  );
}
