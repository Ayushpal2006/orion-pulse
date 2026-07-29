import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Search, Phone, Calendar, Plus, Pencil, Trash2, Loader2, ShoppingBag, Receipt,
  Check, ArrowUpDown, ChevronLeft, ChevronRight, X, Scan, DollarSign, CalendarDays,
  Percent, FileText, Info, AlertTriangle, RefreshCw, Eye, Printer, Share2, Copy, Tag,
  Building2, CornerDownLeft, CheckCircle2, ShoppingCart, ChevronDown, ChevronUp, Sparkles
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/empty-state";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getPurchases,
  getPurchaseById,
  createPurchase,
  updatePurchase,
  deletePurchase,
  voidPurchase,
  downloadPurchasePdf,
  getPurchaseWhatsAppLink,
  getSuppliers,
  getProducts,
  createSupplier,
  buildImageUrl,
} from "@/lib/api";
import { inr } from "@/lib/format";
import { useApp } from "@/lib/store";
import { PurchaseDetailsDialog } from "@/components/purchase-details-dialog";
import { PurchaseDrawer } from "@/components/purchase-drawer";

export const Route = createFileRoute("/purchases")({
  head: () => ({
    meta: [
      { title: "Purchases · Orion POS" },
      { name: "description", content: "Procure inventory, register vendor invoices, and manage purchase history." },
    ],
  }),
  component: PurchasesPage,
});

type FormItem = {
  product_id: number;
  name: string;
  sku: string;
  barcode: string;
  quantity: number;
  purchase_price: number; // in Rupees
  selling_price: number; // in Rupees
  gst: number;
  discount: number;
  image?: string;
};

function PurchasesPage() {
  const queryClient = useQueryClient();
  const userRole = useApp((s) => s.role);
  const [activeTab, setActiveTab] = useState<"history" | "form">("history");

  // Filters & States
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  // Modals & Action targets
  const [editId, setEditId] = useState<number | null>(null);
  const [selectedPurchase, setSelectedPurchase] = useState<any | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedPoId, setSelectedPoId] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [voidTarget, setVoidTarget] = useState<any | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [confirmPoNum, setConfirmPoNum] = useState("");
  const [voiding, setVoiding] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form State
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierOpen, setSupplierOpen] = useState(false);

  // Quick Supplier Creation State
  const [newSupplierOpen, setNewSupplierOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierPhone, setNewSupplierPhone] = useState("");
  const [newSupplierGstin, setNewSupplierGstin] = useState("");

  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().substring(0, 16));
  const [notes, setNotes] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("Paid");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [overallDiscount, setOverallDiscount] = useState<number>(0);
  const [overallTax, setOverallTax] = useState<number>(0);

  const [cartItems, setCartItems] = useState<FormItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  // Selected Products Tray & Click Feedback States
  const [selectedTrayCollapsed, setSelectedTrayCollapsed] = useState(false);
  const [highlightedProductId, setHighlightedProductId] = useState<number | null>(null);
  const [clickFeedbackMap, setClickFeedbackMap] = useState<Record<number, { text: string; id: number }>>({});

  const scrollToProductCard = (productId: number) => {
    const el = document.getElementById(`product-card-${productId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      setHighlightedProductId(productId);
      setTimeout(() => {
        setHighlightedProductId(null);
      }, 850);
    }
  };

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQ(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [q]);

  // Queries
  const { data: rawPurchases = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["purchases", debouncedQ, startDate, endDate],
    queryFn: () => getPurchases({ q: debouncedQ, startDate, endDate }),
  });

  const { data: suppliersList = [] } = useQuery({
    queryKey: ["suppliers-active"],
    queryFn: () => getSuppliers("", "alphabetical", false),
  });

  const { data: productsList = [] } = useQuery({
    queryKey: ["products-active"],
    queryFn: () => getProducts(),
  });

  const handleRefresh = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ["purchases"] });
  };

  const handleQuickCreateSupplier = async () => {
    if (!newSupplierName.trim()) {
      toast.error("Supplier name is required");
      return;
    }
    try {
      const created = await createSupplier({
        name: newSupplierName.trim(),
        phone: newSupplierPhone.trim() || undefined,
        gstin: newSupplierGstin.trim() || undefined,
      });
      toast.success(`Supplier "${created.name}" created!`);
      setSupplierId(Number(created.id));
      await queryClient.invalidateQueries({ queryKey: ["suppliers-active"] });
      setNewSupplierOpen(false);
      setSupplierOpen(false);
      setNewSupplierName("");
      setNewSupplierPhone("");
      setNewSupplierGstin("");
    } catch (err: any) {
      toast.error(err.message || "Failed to create supplier");
    }
  };

  // Convert Date strings to local timezone readable
  const formatLocalDate = (isoStr: string) => {
    if (!isoStr) return "-";
    try {
      return new Date(isoStr).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoStr;
    }
  };

  // Categories extracted from active products
  const categories = useMemo(() => {
    const set = new Set<string>();
    productsList.forEach((p: any) => {
      if (p.category) set.add(p.category);
    });
    return ["All", ...Array.from(set)];
  }, [productsList]);

  // Statistics
  const stats = useMemo(() => {
    const activePurchases = rawPurchases.filter((p: any) => p.status !== "VOID" && p.status !== "DELETED");
    const totalCount = activePurchases.length;
    const totalValuePaise = activePurchases.reduce((acc: number, p: any) => acc + (p.grand_total || 0), 0);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayPurchases = activePurchases.filter((p: any) => {
      const pDate = new Date(p.purchase_date || p.created_at);
      return pDate >= startOfToday;
    });
    const todayValuePaise = todayPurchases.reduce((acc: number, p: any) => acc + (p.grand_total || 0), 0);

    return {
      totalCount,
      totalValue: totalValuePaise / 100.0,
      todayCount: todayPurchases.length,
      todayValue: todayValuePaise / 100.0,
    };
  }, [rawPurchases]);

  // Filtered Suppliers & Products
  const filteredSuppliers = useMemo(() => {
    if (!supplierSearch.trim()) return suppliersList;
    const s = supplierSearch.toLowerCase();
    return suppliersList.filter(
      (sup: any) =>
        sup.name.toLowerCase().includes(s) ||
        (sup.phone && sup.phone.includes(s))
    );
  }, [supplierSearch, suppliersList]);

  const filteredProducts = useMemo(() => {
    return productsList.filter((prod: any) => {
      const matchesSearch =
        !productSearch.trim() ||
        prod.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        (prod.sku && prod.sku.toLowerCase().includes(productSearch.toLowerCase())) ||
        (prod.barcode && prod.barcode.includes(productSearch.trim()));

      const matchesCat = selectedCategory === "All" || prod.category === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [productSearch, selectedCategory, productsList]);

  const selectedSupplierName = useMemo(() => {
    const found = suppliersList.find((s: any) => Number(s.id) === supplierId);
    return found ? found.name : "Select Supplier";
  }, [supplierId, suppliersList]);

  // Add Product to Purchase Cart with Click Animation Feedback
  const handleAddProductToCart = (prod: any) => {
    const pId = Number(prod.id);
    const existingIdx = cartItems.findIndex((item) => item.product_id === pId);

    // Trigger floating click feedback badge
    const feedbackId = Date.now();
    const newQty = existingIdx !== -1 ? cartItems[existingIdx].quantity + 1 : 1;
    setClickFeedbackMap((prev) => ({
      ...prev,
      [pId]: { text: `+1 Added (Qty ${newQty})`, id: feedbackId },
    }));

    setTimeout(() => {
      setClickFeedbackMap((prev) => {
        if (prev[pId]?.id === feedbackId) {
          const next = { ...prev };
          delete next[pId];
          return next;
        }
        return prev;
      });
    }, 450);

    if (existingIdx !== -1) {
      const newItems = [...cartItems];
      newItems[existingIdx].quantity += 1;
      setCartItems(newItems);
      toast.info(`Increased "${prod.name}" quantity to ${newQty}`);
    } else {
      // Extract Purchase Cost from Inventory product
      const initialPurchaseCost =
        typeof prod.purchase === "number" && !isNaN(prod.purchase)
          ? prod.purchase
          : typeof prod.purchase_price === "number" && !isNaN(prod.purchase_price)
            ? prod.purchase_price / 100.0
            : 0;

      const initialSellingPrice =
        typeof prod.price === "number" && !isNaN(prod.price)
          ? prod.price
          : typeof prod.selling_price === "number" && !isNaN(prod.selling_price)
            ? prod.selling_price / 100.0
            : 0;

      setCartItems([
        ...cartItems,
        {
          product_id: pId,
          name: prod.name,
          sku: prod.sku || "",
          barcode: prod.barcode || "",
          quantity: 1,
          purchase_price: initialPurchaseCost,
          selling_price: initialSellingPrice,
          gst: prod.gst || 0,
          discount: 0,
          image: prod.image || prod.image_url || buildImageUrl(prod.image_url),
        },
      ]);
      toast.success(`Added "${prod.name}" to cart`);
    }
  };

  const handleQtyChange = (index: number, delta: number) => {
    setCartItems((prev) => {
      const copy = [...prev];
      const newQty = Math.max(1, copy[index].quantity + delta);
      copy[index] = { ...copy[index], quantity: newQty };
      return copy;
    });
  };

  const handleRemoveCartItem = (index: number) => {
    setCartItems(cartItems.filter((_, i) => i !== index));
  };

  const updateCartItemField = (index: number, field: keyof FormItem, value: any) => {
    setCartItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Cart Calculations
  const calculatedTotals = useMemo(() => {
    const subtotal = cartItems.reduce((acc, item) => acc + item.quantity * item.purchase_price, 0);
    const itemDiscounts = cartItems.reduce((acc, item) => acc + item.quantity * (item.discount || 0), 0);
    const grandTotal = Math.max(0, subtotal - itemDiscounts - (overallDiscount || 0) + (overallTax || 0));
    return {
      subtotal,
      itemDiscounts,
      grandTotal,
    };
  }, [cartItems, overallDiscount, overallTax]);

  // Form Submit
  const handleSubmit = async () => {
    const parsedSupplierId = parseInt(String(supplierId), 10);
    if (!parsedSupplierId || isNaN(parsedSupplierId) || parsedSupplierId <= 0) {
      toast.error("Please select a valid supplier");
      return;
    }
    if (cartItems.length === 0) {
      toast.error("Please add at least one product item");
      return;
    }

    const payload = {
      supplier_id: parsedSupplierId,
      po_number: editId ? undefined : undefined,
      supplier_invoice_number: supplierInvoiceNumber.trim() || undefined,
      invoice_number: supplierInvoiceNumber.trim() || undefined,
      purchase_date: purchaseDate ? new Date(purchaseDate).toISOString() : new Date().toISOString(),
      invoice_date: purchaseDate ? new Date(purchaseDate).toISOString() : new Date().toISOString(),
      discount: Math.max(0, overallDiscount),
      gst: Math.max(0, overallTax),
      tax: Math.max(0, overallTax),
      payment_status: paymentStatus || "Paid",
      payment_method: paymentMethod || "Cash",
      notes: notes.trim() || undefined,
      items: cartItems.map((item) => ({
        product_id: Number(item.product_id),
        quantity: Math.max(1, item.quantity),
        purchase_price: Math.max(0, item.purchase_price),
        selling_price: item.selling_price,
      })),
    };

    try {
      if (editId) {
        await updatePurchase(editId, payload);
        toast.success(`Purchase PO #${editId} updated successfully`);
      } else {
        await createPurchase(payload);
        toast.success(`Purchase order recorded successfully`);
      }

      handleResetForm();
      setActiveTab("history");
      handleRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to record purchase");
    }
  };

  const handleResetForm = () => {
    setEditId(null);
    setSupplierId(null);
    setSupplierSearch("");
    setSupplierInvoiceNumber("");
    setPurchaseDate(new Date().toISOString().substring(0, 16));
    setNotes("");
    setPaymentStatus("Paid");
    setPaymentMethod("Cash");
    setOverallDiscount(0);
    setOverallTax(0);
    setCartItems([]);
  };

  const handleTriggerEdit = async (poId: number) => {
    try {
      const po = await getPurchaseById(poId);
      if (!po) {
        toast.error("Purchase order not found");
        return;
      }
      setEditId(poId);
      setSupplierId(Number(po.supplier_id));
      setSupplierInvoiceNumber(po.supplier_invoice_number || po.invoice_number || "");
      setPurchaseDate(new Date(po.purchase_date || po.created_at).toISOString().substring(0, 16));
      setNotes(po.notes || "");
      setPaymentStatus(po.payment_status || "Paid");
      setPaymentMethod(po.payment_method || "Cash");
      setOverallDiscount(po.discount / 100.0);
      setOverallTax((po.gst || po.tax || 0) / 100.0);

      const mapped = (po.items || []).map((i: any) => ({
        product_id: i.product_id,
        name: i.product_name || `Product #${i.product_id}`,
        sku: i.product_sku || "",
        barcode: "",
        quantity: i.quantity,
        purchase_price: i.purchase_price / 100.0,
        selling_price: (i.selling_price || i.purchase_price) / 100.0,
        gst: i.gst || 0,
        discount: i.discount ? i.discount / 100.0 : 0,
      }));
      setCartItems(mapped);
      setActiveTab("form");
    } catch (e: any) {
      toast.error("Failed to load purchase details: " + e.message);
    }
  };

  const handleDuplicate = async (poId: number) => {
    try {
      const po = await getPurchaseById(poId);
      if (!po) {
        toast.error("Purchase order not found");
        return;
      }
      setEditId(null);
      setSupplierId(Number(po.supplier_id));
      setSupplierInvoiceNumber("");
      setPurchaseDate(new Date().toISOString().substring(0, 16));
      setNotes(po.notes ? `Duplicated from ${po.po_number}. ${po.notes}` : `Duplicated from ${po.po_number}`);
      setPaymentStatus(po.payment_status || "Paid");
      setPaymentMethod(po.payment_method || "Cash");
      setOverallDiscount(po.discount / 100.0);
      setOverallTax((po.gst || po.tax || 0) / 100.0);

      const mapped = (po.items || []).map((i: any) => ({
        product_id: i.product_id,
        name: i.product_name || `Product #${i.product_id}`,
        sku: i.product_sku || "",
        barcode: "",
        quantity: i.quantity,
        purchase_price: i.purchase_price / 100.0,
        selling_price: (i.selling_price || i.purchase_price) / 100.0,
        gst: i.gst || 0,
        discount: i.discount ? i.discount / 100.0 : 0,
      }));
      setCartItems(mapped);
      setActiveTab("form");
      toast.success(`Draft Purchase populated from ${po.po_number}`);
    } catch (e: any) {
      toast.error("Failed to duplicate purchase: " + e.message);
    }
  };

  const handleVoidAction = async () => {
    if (!voidTarget) return;
    if (!voidReason.trim()) {
      toast.error("Please specify a reason to void this purchase order");
      return;
    }
    const last4 = (voidTarget.po_number || "").slice(-4);
    if (confirmPoNum.trim() !== last4) {
      toast.error("The last 4 digits of the PO number do not match");
      return;
    }

    setVoiding(true);
    try {
      await voidPurchase(voidTarget.id, voidReason.trim());
      toast.success(`Purchase ${voidTarget.po_number} voided successfully`);
      setVoidTarget(null);
      setVoidReason("");
      setConfirmPoNum("");
      handleRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to void purchase order");
    } finally {
      setVoiding(false);
    }
  };

  const handleDeleteAction = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deletePurchase(deleteTarget.id);
      toast.success(`Purchase ${deleteTarget.po_number} soft-deleted`);
      setDeleteTarget(null);
      handleRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete purchase order");
    } finally {
      setDeleting(false);
    }
  };

  const handleDownloadPdf = async (poId: number, poNum: string) => {
    try {
      const blob = await downloadPurchasePdf(poId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${poNum}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("PDF downloaded");
    } catch (err: any) {
      toast.error(err.message || "Failed to download PDF");
    }
  };

  const handleWhatsApp = async (poId: number) => {
    try {
      const url = await getPurchaseWhatsAppLink(poId);
      window.open(url, "_blank");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate WhatsApp share link");
    }
  };

  const paginatedPurchases = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return rawPurchases.slice(start, start + itemsPerPage);
  }, [rawPurchases, page]);
  const totalPages = Math.ceil(rawPurchases.length / itemsPerPage);

  const renderStatusBadge = (p: any) => {
    if (p.status === "VOID") return <Badge variant="destructive" className="font-bold text-[10px]">VOID</Badge>;
    if (p.status === "DELETED") return <Badge variant="destructive" className="font-bold text-[10px] bg-rose-900">DELETED</Badge>;
    if (p.status === "Draft") return <Badge variant="secondary" className="font-bold text-[10px]">DRAFT</Badge>;
    return <Badge className="bg-emerald-600 font-bold text-[10px]">COMPLETED</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Purchase Stock</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Procure inventory, manage vendor invoices, and track purchase costing.
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === "history" ? (
            <>
              <Button variant="outline" size="sm" className="rounded-xl h-11" onClick={handleRefresh}>
                <RefreshCw className="size-4" />
              </Button>
              <Button onClick={() => { handleResetForm(); setActiveTab("form"); }} className="h-11 rounded-xl font-bold">
                <Plus className="mr-2 size-4" /> New Purchase
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => { handleResetForm(); setActiveTab("history"); }} className="h-11 rounded-xl">
              <CornerDownLeft className="mr-2 size-4" /> Back to Purchase History
            </Button>
          )}
        </div>
      </div>

      {activeTab === "history" ? (
        <>
          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card-soft p-4 flex items-center gap-3">
              <div className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center"><ShoppingBag className="size-5" /></div>
              <div>
                <div className="text-2xl font-bold tracking-tight text-foreground">{inr(stats.todayValue)}</div>
                <div className="text-[10px] text-muted-foreground font-medium uppercase">Today's Purchases</div>
              </div>
            </div>
            <div className="card-soft p-4 flex items-center gap-3">
              <div className="size-10 rounded-xl bg-teal-500/10 text-teal-500 grid place-items-center"><Receipt className="size-5" /></div>
              <div>
                <div className="text-2xl font-bold tracking-tight text-foreground">{stats.todayCount}</div>
                <div className="text-[10px] text-muted-foreground font-medium uppercase">Today's Orders</div>
              </div>
            </div>
            <div className="card-soft p-4 flex items-center gap-3">
              <div className="size-10 rounded-xl bg-amber-500/10 text-amber-500 grid place-items-center"><DollarSign className="size-5" /></div>
              <div>
                <div className="text-2xl font-bold tracking-tight text-foreground">{inr(stats.totalValue)}</div>
                <div className="text-[10px] text-muted-foreground font-medium uppercase">Total Procurement Value</div>
              </div>
            </div>
            <div className="card-soft p-4 flex items-center gap-3">
              <div className="size-10 rounded-xl bg-purple-500/10 text-purple-500 grid place-items-center"><CalendarDays className="size-5" /></div>
              <div>
                <div className="text-2xl font-bold tracking-tight text-foreground">{stats.totalCount}</div>
                <div className="text-[10px] text-muted-foreground font-medium uppercase">Total PO Count</div>
              </div>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="card-soft p-3 flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search PO#, Supplier Invoice#, Supplier Name, or Phone..."
                className="h-11 rounded-xl pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">From</span>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                  className="h-11 rounded-xl w-36"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">To</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                  className="h-11 rounded-xl w-36"
                />
              </div>
              {(startDate || endDate) && (
                <Button variant="outline" onClick={() => { setStartDate(""); setEndDate(""); setPage(1); }} className="h-11 rounded-xl">
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* History Table */}
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <div className="flex h-32 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center">
              <div className="text-sm font-semibold text-foreground">Purchase history could not be loaded</div>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="mr-2 size-4" /> Retry
              </Button>
            </div>
          ) : paginatedPurchases.length === 0 ? (
            <EmptyState
              icon={<Receipt className="size-5" />}
              title="No purchase orders found"
              description="Record your vendor invoices and stock intakes to get started."
              action={<Button onClick={() => setActiveTab("form")}><Plus className="mr-2 size-4" /> New Purchase</Button>}
            />
          ) : (
            <div className="space-y-4">
              <div className="card-soft overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="p-4 table-header-cell">PO Number</th>
                        <th className="p-4 table-header-cell">Supplier</th>
                        <th className="p-4 table-header-cell">Date</th>
                        <th className="p-4 table-header-cell">Supplier Inv #</th>
                        <th className="p-4 table-header-cell">Status</th>
                        <th className="p-4 text-right table-header-cell">Grand Total</th>
                        <th className="p-4 text-right table-header-cell">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {paginatedPurchases.map((p: any) => (
                        <tr
                          key={p.id}
                          onClick={() => { setSelectedPoId(p.id); setDrawerOpen(true); }}
                          className="hover:bg-muted/50 transition-colors cursor-pointer group"
                        >
                          <td className="p-4 font-mono text-xs font-bold text-primary group-hover:underline">{p.po_number || p.purchase_number}</td>
                          <td className="p-4 font-semibold text-foreground">
                            <div>{p.supplier_name || "N/A"}</div>
                            {p.supplier_phone && <div className="text-[10px] text-muted-foreground font-mono">{p.supplier_phone}</div>}
                          </td>
                          <td className="p-4 text-xs font-medium text-muted-foreground">{formatLocalDate(p.purchase_date || p.created_at)}</td>
                          <td className="p-4 text-xs font-mono text-muted-foreground">{p.supplier_invoice_number || p.invoice_number || "-"}</td>
                          <td className="p-4">
                            <div className="flex items-center gap-1.5">
                              {renderStatusBadge(p)}
                              <span className="text-[10px] text-muted-foreground font-medium">({p.payment_status || "Paid"})</span>
                            </div>
                          </td>
                          <td className="p-4 text-right font-mono font-extrabold text-foreground">{inr((p.grand_total || 0) / 100.0)}</td>
                          <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs rounded-xl font-semibold hover:bg-primary/10"
                              onClick={() => { setSelectedPoId(p.id); setDrawerOpen(true); }}
                            >
                              <Eye className="size-3.5 mr-1.5 text-primary" /> View Details
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-2">
                  <div className="text-xs text-muted-foreground">
                    Page {page} of {totalPages} ({rawPurchases.length} purchases)
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(p - 1, 1))}
                      disabled={page === 1}
                      className="rounded-lg h-9 w-9 p-0"
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                      disabled={page === totalPages}
                      className="rounded-lg h-9 w-9 p-0"
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        /* POS-Style Purchase Screen (Left: Product Grid/List; Right: Purchase Cart & Checkout) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: Product Catalog & Search (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="card-soft p-4 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Search product by name, SKU, or scan barcode..."
                    className="h-11 rounded-xl pl-9 pr-9"
                  />
                  <Scan className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                </div>
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                      selectedCategory === cat
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted/40 text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Products Tray (Collapsible Tray above Product Grid) */}
            {cartItems.length > 0 && (
              <div className="card-soft p-3 space-y-2 border-emerald-500/40 bg-emerald-500/5 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setSelectedTrayCollapsed(!selectedTrayCollapsed)}
                    className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:text-emerald-600 transition-colors cursor-pointer"
                  >
                    <Sparkles className="size-3.5 text-emerald-500" />
                    <span>Selected Products ({cartItems.length})</span>
                    {selectedTrayCollapsed ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
                  </button>
                  <span className="text-[10px] font-mono text-muted-foreground">Click item to smart-scroll to card</span>
                </div>

                {!selectedTrayCollapsed && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none pt-1">
                    {cartItems.map((item) => (
                      <button
                        key={item.product_id}
                        type="button"
                        onClick={() => scrollToProductCard(item.product_id)}
                        className="shrink-0 flex items-center gap-2 p-1.5 rounded-xl bg-background border border-emerald-500/30 hover:border-emerald-500 text-left transition-all shadow-2xs group cursor-pointer"
                        title={`Click to scroll to ${item.name}`}
                      >
                        <div className="size-7 rounded-lg overflow-hidden bg-muted/40 border border-border/50 shrink-0 flex items-center justify-center">
                          {item.image ? (
                            <img src={buildImageUrl(item.image) || item.image} alt={item.name} className="size-full object-cover" />
                          ) : (
                            <span className="text-xs">🛍️</span>
                          )}
                        </div>
                        <div className="min-w-0 pr-1">
                          <div className="text-[11px] font-bold text-foreground truncate max-w-[100px] group-hover:text-emerald-600">
                            {item.name}
                          </div>
                          <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground">
                            <span className="text-emerald-600 font-bold">Qty: {item.quantity}</span>
                            <span>•</span>
                            <span>{inr(item.purchase_price)}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Product Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[620px] overflow-y-auto pr-1">
              {filteredProducts.length === 0 ? (
                <div className="col-span-full card-soft p-8 text-center text-xs text-muted-foreground">
                  No products found matching &ldquo;{productSearch}&rdquo;
                </div>
              ) : (
                filteredProducts.map((prod: any) => {
                  const costRupees =
                    typeof prod.purchase === "number" && !isNaN(prod.purchase)
                      ? prod.purchase
                      : typeof prod.purchase_price === "number" && !isNaN(prod.purchase_price)
                        ? prod.purchase_price / 100.0
                        : 0;
                  const cartItem = cartItems.find((item) => item.product_id === prod.id);
                  const isSelected = !!cartItem && cartItem.quantity > 0;

                  return (
                    <div
                      key={prod.id}
                      id={`product-card-${prod.id}`}
                      onClick={() => handleAddProductToCart(prod)}
                      className={`card-soft p-3 cursor-pointer transition-all duration-200 ease-in-out hover:shadow-md group flex flex-col justify-between relative rounded-2xl ${
                        highlightedProductId === prod.id
                          ? "ring-4 ring-emerald-500 scale-[1.02] shadow-xl bg-emerald-500/20 border-emerald-500 animate-pulse"
                          : isSelected
                          ? "border-emerald-500/80 bg-emerald-500/10 ring-2 ring-emerald-500/30 shadow-md dark:bg-emerald-950/20"
                          : "hover:border-primary/50"
                      }`}
                    >
                      {/* Floating Click Feedback Badge (+1 Added) */}
                      {clickFeedbackMap[prod.id] && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-600 text-white font-bold text-[10px] px-2 py-0.5 rounded-full shadow-lg z-30 animate-in fade-in slide-in-from-bottom-2 duration-200 flex items-center gap-1">
                          <Check className="size-3 stroke-[3]" /> {clickFeedbackMap[prod.id].text}
                        </div>
                      )}

                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <div className="relative size-11 rounded-xl overflow-hidden bg-muted/40 border border-border/60 shrink-0 flex items-center justify-center shadow-2xs">
                            {prod.image || prod.image_url ? (
                              <img
                                src={buildImageUrl(prod.image || prod.image_url) || prod.image || prod.image_url}
                                alt={prod.name}
                                className="size-full object-cover rounded-xl transition-transform duration-300 group-hover:scale-105"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                            ) : (
                              <span className="text-xl">🛍️</span>
                            )}
                            {isSelected && (
                              <span className="absolute -top-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow-2xs animate-in zoom-in-50 z-10">
                                <ShoppingCart className="size-2.5" />
                              </span>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge variant="outline" className="text-[9px] font-mono">Stock: {prod.stock}</Badge>
                            {isSelected && (
                              <div className="flex items-center gap-1 animate-in fade-in zoom-in-95">
                                <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[9px] px-1.5 py-0.5 shadow-2xs flex items-center gap-0.5">
                                  <Check className="size-2.5 stroke-[3]" /> Selected
                                </Badge>
                                <Badge variant="outline" className="border-emerald-500/50 text-emerald-700 dark:text-emerald-300 bg-emerald-500/20 font-mono font-bold text-[9px] px-1.5 py-0.5">
                                  Qty: {cartItem.quantity}
                                </Badge>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className={`font-bold text-xs mt-2 line-clamp-2 transition-colors ${isSelected ? "text-emerald-950 dark:text-emerald-200 font-extrabold" : "text-foreground group-hover:text-primary"}`}>
                          {prod.name}
                        </div>
                        {prod.sku && <div className="text-[10px] text-muted-foreground font-mono">{prod.sku}</div>}
                      </div>
                      <div className={`mt-3 pt-2 border-t flex items-center justify-between transition-colors ${isSelected ? "border-emerald-500/30" : "border-border/40"}`}>
                        <span className="text-[10px] text-muted-foreground uppercase font-semibold">Purchase Cost</span>
                        <span className={`font-mono font-black text-xs ${isSelected ? "text-emerald-700 dark:text-emerald-300" : "text-foreground"}`}>{inr(costRupees)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT: Purchase Cart & Checkout Panel (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Quick Summary Bar */}
            <div className="card-soft p-3.5 bg-muted/20 border border-border/60 rounded-2xl space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>Purchase Quick Summary</span>
                <span className="font-mono text-emerald-600 font-bold">Live Updates</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2 rounded-xl bg-background border border-border/50">
                  <div className="text-[10px] text-muted-foreground font-sans">Selected Products</div>
                  <div className="font-bold text-foreground text-sm">{cartItems.length}</div>
                </div>
                <div className="p-2 rounded-xl bg-background border border-border/50">
                  <div className="text-[10px] text-muted-foreground font-sans">Total Quantity</div>
                  <div className="font-bold text-foreground text-sm">{cartItems.reduce((sum, i) => sum + i.quantity, 0)} Pcs</div>
                </div>
                <div className="p-2 rounded-xl bg-background border border-border/50">
                  <div className="text-[10px] text-muted-foreground font-sans">Estimated Amount</div>
                  <div className="font-bold text-emerald-600 text-sm">{inr(cartItems.reduce((sum, i) => sum + (i.purchase_price * i.quantity), 0))}</div>
                </div>
                <div className="p-2 rounded-xl bg-background border border-border/50">
                  <div className="text-[10px] text-muted-foreground font-sans">Supplier</div>
                  <div className="font-bold text-foreground text-xs truncate">{selectedSupplierName}</div>
                </div>
              </div>
            </div>

            <div className="card-soft p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="size-5 text-primary" />
                  <h2 className="text-base font-bold text-foreground">Purchase Cart</h2>
                </div>
                <Badge variant="outline" className="font-mono text-xs">{cartItems.length} Items</Badge>
              </div>

              {/* Cart Items List */}
              <div className="divide-y divide-border/60 max-h-56 overflow-y-auto pr-1">
                {cartItems.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground space-y-3 flex flex-col items-center justify-center border-2 border-dashed border-border/60 rounded-2xl bg-muted/10 my-1">
                    <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-2xl">
                      🛒
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-bold text-sm text-foreground">Purchase Cart Empty</h4>
                      <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                        No products selected yet. Click any product card to start creating a purchase order.
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-mono text-emerald-600 border-emerald-500/30 bg-emerald-500/10">
                      Selected products will automatically be highlighted
                    </Badge>
                  </div>
                ) : (
                  cartItems.map((item, idx) => (
                    <div key={idx} className="py-2.5 space-y-1.5 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="size-8 rounded-lg overflow-hidden bg-muted/40 border border-border/50 shrink-0 flex items-center justify-center">
                          {item.image ? (
                            <img
                              src={buildImageUrl(item.image) || item.image}
                              alt={item.name}
                              className="size-full object-cover rounded-lg"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          ) : (
                            <span className="text-xs">🛍️</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-foreground truncate">{item.name}</div>
                          {item.sku && <div className="text-[10px] text-muted-foreground font-mono">{item.sku}</div>}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveCartItem(idx)}
                          className="size-6 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-md shrink-0"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-12 gap-2 items-center">
                        {/* Qty Controls */}
                        <div className="col-span-5 flex items-center gap-1 border border-border rounded-lg p-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleQtyChange(idx, -1)}
                            className="size-6 rounded-md"
                          >
                            -
                          </Button>
                          <Input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => updateCartItemField(idx, "quantity", parseInt(e.target.value, 10) || 1)}
                            className="h-6 w-10 text-center font-mono font-bold text-xs p-0 border-none bg-transparent shadow-none"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleQtyChange(idx, 1)}
                            className="size-6 rounded-md"
                          >
                            +
                          </Button>
                        </div>

                        {/* Buying Price Input */}
                        <div className="col-span-4">
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            value={item.purchase_price}
                            onChange={(e) => updateCartItemField(idx, "purchase_price", parseFloat(e.target.value) || 0)}
                            className="h-7 rounded-lg text-right font-mono text-xs"
                            placeholder="Price"
                          />
                        </div>

                        {/* Line Total */}
                        <div className="col-span-3 text-right font-mono font-bold text-foreground">
                          {inr(item.quantity * item.purchase_price)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Checkout Form & Details */}
              <div className="border-t border-border pt-3 space-y-3">
                {/* Supplier Autocomplete */}
                <div className="space-y-1.5 relative">
                  <label className="text-xs font-bold text-foreground flex items-center justify-between">
                    <span>Supplier Selection *</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setNewSupplierOpen(true)}
                      className="h-5 px-1.5 text-[10px] text-primary hover:bg-primary/10"
                    >
                      <Plus className="mr-1 size-3" /> Add Supplier
                    </Button>
                  </label>
                  <div className="relative">
                    <Button
                      variant="outline"
                      className="w-full text-left justify-between h-10 rounded-xl bg-background text-xs font-semibold"
                      onClick={() => setSupplierOpen(!supplierOpen)}
                    >
                      <span>{selectedSupplierName}</span>
                      <ArrowUpDown className="size-3 text-muted-foreground shrink-0" />
                    </Button>
                    {supplierOpen && (
                      <div className="absolute top-11 left-0 w-full bg-popover text-popover-foreground border border-border rounded-xl shadow-lg z-50 p-2 space-y-2">
                        <Input
                          value={supplierSearch}
                          onChange={(e) => setSupplierSearch(e.target.value)}
                          placeholder="Search supplier..."
                          className="h-8 text-xs rounded-lg"
                        />
                        <div className="max-h-36 overflow-y-auto divide-y divide-border/40">
                          {filteredSuppliers.map((s: any) => (
                            <button
                              key={s.id}
                              onClick={() => {
                                setSupplierId(Number(s.id));
                                setSupplierSearch("");
                                setSupplierOpen(false);
                              }}
                              className="flex w-full items-center justify-between p-2 text-xs text-left hover:bg-muted rounded-lg"
                            >
                              <div>
                                <div className="font-semibold">{s.name}</div>
                                {s.phone && <div className="text-[10px] text-muted-foreground">{s.phone}</div>}
                              </div>
                              {supplierId === Number(s.id) && <Check className="size-3.5 text-primary" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Supplier Invoice # & Date */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase">Supplier Inv #</label>
                    <Input
                      placeholder="e.g. INV-45872"
                      value={supplierInvoiceNumber}
                      onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                      className="h-9 rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase">Purchase Date</label>
                    <Input
                      type="datetime-local"
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                      className="h-9 rounded-xl text-xs"
                    />
                  </div>
                </div>

                {/* Payment Status & Method */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase">Payment Status</label>
                    <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                      <SelectTrigger className="h-9 rounded-xl text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl text-xs">
                        <SelectItem value="Paid">Paid</SelectItem>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Partially Paid">Partially Paid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase">Payment Method</label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger className="h-9 rounded-xl text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl text-xs">
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="UPI">UPI</SelectItem>
                        <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                        <SelectItem value="Card">Card</SelectItem>
                        <SelectItem value="Cheque">Cheque</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Totals Summary */}
                <div className="border-t border-border pt-3 space-y-1 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="font-mono font-bold text-foreground">{inr(calculatedTotals.subtotal)}</span>
                  </div>
                  <div className="flex justify-between items-center text-muted-foreground gap-2">
                    <span>Overall Discount (₹)</span>
                    <Input
                      type="number"
                      min={0}
                      value={overallDiscount}
                      onChange={(e) => setOverallDiscount(parseFloat(e.target.value) || 0)}
                      className="w-24 h-7 text-right rounded-lg font-mono text-xs"
                    />
                  </div>
                  <div className="flex justify-between text-sm font-black border-t border-dashed border-border pt-2">
                    <span>Grand Total</span>
                    <span className="font-mono text-money">{inr(calculatedTotals.grandTotal)}</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={handleResetForm} className="flex-1 rounded-xl h-11 text-xs">
                    Reset
                  </Button>
                  <Button onClick={handleSubmit} className="flex-1 rounded-xl h-11 text-xs font-bold bg-primary text-primary-foreground">
                    {editId ? "Save Changes" : "Save Purchase"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Details Dialog */}
      <PurchaseDetailsDialog
        purchase={selectedPurchase}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />

      {/* Void Confirmation Dialog */}
      <Dialog open={!!voidTarget} onOpenChange={(v) => !v && setVoidTarget(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl gap-4 p-5">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-rose-600 font-bold flex items-center gap-2 text-lg">
              <Trash2 className="size-5" /> Void Purchase Order
            </DialogTitle>
            <DialogDescription className="text-xs font-mono bg-muted/50 px-2.5 py-1 rounded-md border border-border w-fit text-foreground font-medium">
              PO #{voidTarget?.po_number}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.05] p-3 text-xs text-rose-700 flex gap-2.5 shadow-sm">
            <AlertTriangle className="size-5 shrink-0 mt-0.5 text-rose-500" />
            <div className="space-y-1">
              <div className="font-bold text-rose-800">Reversal Warning</div>
              <div className="leading-relaxed opacity-90">
                Voiding this purchase order will reverse product stock levels and deduct the amount from the supplier's balance ledger.
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Reason for voiding *</label>
              <Textarea
                placeholder="Enter void reason..."
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="rounded-xl min-h-[60px] text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                Type last 4 digits of PO (<span className="font-mono text-rose-600 font-bold">{(voidTarget?.po_number || "").slice(-4)}</span>) to confirm
              </label>
              <Input
                placeholder="Enter last 4 digits"
                maxLength={4}
                value={confirmPoNum}
                onChange={(e) => setConfirmPoNum(e.target.value)}
                className="h-9 rounded-xl font-mono text-xs text-center tracking-widest uppercase"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setVoidTarget(null)} className="rounded-xl h-9 text-xs">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleVoidAction}
              disabled={voiding || !voidReason.trim() || confirmPoNum.trim() !== (voidTarget?.po_number || "").slice(-4)}
              className="rounded-xl h-9 text-xs font-bold"
            >
              {voiding ? "Voiding..." : "Confirm Void"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Soft Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-rose-600 font-bold">Soft Delete Purchase {deleteTarget?.po_number}?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-relaxed">
              This will mark the purchase order as DELETED, reverse inventory stock and supplier ledger balance, and remove it from financial reports. Audit history will be retained.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl h-9 text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAction}
              disabled={deleting}
              className="rounded-xl h-9 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white"
            >
              {deleting ? "Deleting..." : "Confirm Soft Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Quick Create Supplier Dialog */}
      <Dialog open={newSupplierOpen} onOpenChange={setNewSupplierOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-5 text-primary" /> Create New Supplier
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Supplier Name *</label>
              <Input
                placeholder="Vendor / Business Name"
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
                className="h-10 rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Phone</label>
                <Input
                  placeholder="Mobile number"
                  value={newSupplierPhone}
                  onChange={(e) => setNewSupplierPhone(e.target.value)}
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase text-muted-foreground">GSTIN</label>
                <Input
                  placeholder="22AAAAA0000A1Z5"
                  value={newSupplierGstin}
                  onChange={(e) => setNewSupplierGstin(e.target.value)}
                  className="h-10 rounded-xl"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewSupplierOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleQuickCreateSupplier} className="rounded-xl font-bold bg-primary text-primary-foreground">
              Save Supplier & Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Right Drawer for Purchase Details & Actions */}
      <PurchaseDrawer
        purchaseId={selectedPoId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onEdit={handleTriggerEdit}
        onDuplicate={handleDuplicate}
      />
    </div>
  );
}
