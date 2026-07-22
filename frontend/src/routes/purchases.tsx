import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search, Phone, Calendar, Plus, Pencil, Trash2, Loader2, ShoppingBag, Receipt,
  Check, ArrowUpDown, ChevronLeft, ChevronRight, X, Scan, DollarSign, CalendarDays,
  Percent, FileText, Info, AlertTriangle, RefreshCw
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/empty-state";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getPurchases, getPurchaseById, createPurchase, updatePurchase, deletePurchase, getSuppliers, getProducts, createSupplier } from "@/lib/api";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/purchases")({
  head: () => ({
    meta: [
      { title: "Purchases · Apka Bill" },
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
};

function PurchasesPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"history" | "form">("history");
  
  // Filters & States
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  // Edit / Details target
  const [editId, setEditId] = useState<number | null>(null);
  const [detailsId, setDetailsId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  // Form State
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierOpen, setSupplierOpen] = useState(false);

  // Quick Supplier Creation State
  const [newSupplierOpen, setNewSupplierOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierPhone, setNewSupplierPhone] = useState("");
  const [newSupplierGstin, setNewSupplierGstin] = useState("");

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

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().substring(0, 16));
  const [notes, setNotes] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("Paid");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [discount, setDiscount] = useState<number>(0);
  const [tax, setTax] = useState<number>(0);

  const [formItems, setFormItems] = useState<FormItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [productOpen, setProductOpen] = useState(false);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQ(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [q]);

  // Load Queries
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

  const { data: purchaseDetails, isLoading: isDetailsLoading } = useQuery({
    queryKey: ["purchase-details", detailsId],
    queryFn: () => (detailsId ? getPurchaseById(detailsId) : null),
    enabled: !!detailsId,
  });

  const handleRefresh = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ["purchases"] });
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

  // Calculate statistics
  const stats = useMemo(() => {
    const totalCount = rawPurchases.length;
    const totalValuePaise = rawPurchases.reduce((acc: number, p: any) => acc + (p.grand_total || 0), 0);
    
    // Today's Purchases
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayPurchases = rawPurchases.filter((p: any) => {
      const pDate = new Date(p.purchase_date);
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

  // Autocomplete filtering
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
    if (!productSearch.trim()) return productsList;
    const p = productSearch.toLowerCase();
    return productsList.filter(
      (prod: any) =>
        prod.name.toLowerCase().includes(p) ||
        prod.sku.toLowerCase().includes(p) ||
        (prod.barcode && prod.barcode.includes(p))
    );
  }, [productSearch, productsList]);

  // Selected Supplier name helper
  const selectedSupplierName = useMemo(() => {
    const found = suppliersList.find((s: any) => Number(s.id) === supplierId);
    return found ? found.name : "Select Supplier";
  }, [supplierId, suppliersList]);

  // Handle adding product
  const handleSelectProduct = (prod: any) => {
    // Check if product already added
    const idx = formItems.findIndex((item) => item.product_id === prod.id);
    if (idx !== -1) {
      // Increment quantity
      const newItems = [...formItems];
      newItems[idx].quantity += 1;
      setFormItems(newItems);
      toast.info(`Incremented "${prod.name}" quantity`);
    } else {
      setFormItems([
        ...formItems,
        {
          product_id: prod.id,
          name: prod.name,
          sku: prod.sku,
          barcode: prod.barcode || "",
          quantity: 1,
          purchase_price: prod.purchase ? prod.purchase / 100.0 : 0, // convert paise to Rupees
          selling_price: prod.price ? prod.price / 100.0 : 0, // convert paise to Rupees
        },
      ]);
      toast.success(`Added "${prod.name}" to items`);
    }
    setProductSearch("");
    setProductOpen(false);
  };

  // Barcode support
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productSearch.trim()) return;
    const match = productsList.find((p: any) => p.barcode === productSearch.trim());
    if (match) {
      handleSelectProduct(match);
    } else {
      toast.error(`No product found with barcode "${productSearch}"`);
    }
  };

  // Keyboard Navigation: Add row with enter
  const handleKeyDown = (e: React.KeyboardEvent, index: number, field: "qty" | "purchase" | "selling") => {
    if (e.key === "Enter") {
      e.preventDefault();
      // Auto-focus next field or product search
      if (field === "qty") {
        document.getElementById(`purchase-price-${index}`)?.focus();
      } else if (field === "purchase") {
        document.getElementById(`selling-price-${index}`)?.focus();
      } else if (field === "selling") {
        // Trigger product search focus to add next product
        document.getElementById("product-autocomplete-input")?.focus();
      }
    }
  };

  // Remove row
  const handleRemoveItem = (index: number) => {
    setFormItems(formItems.filter((_, i) => i !== index));
  };

  // Update item field
  const updateItemField = (index: number, field: "quantity" | "purchase_price" | "selling_price", value: number) => {
    const updated = [...formItems];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };
    setFormItems(updated);
  };

  // Calculations
  const calculatedTotals = useMemo(() => {
    const subtotal = formItems.reduce((acc, item) => acc + item.quantity * item.purchase_price, 0);
    const grandTotal = subtotal - (discount || 0) + (tax || 0);
    return {
      subtotal,
      grandTotal: grandTotal > 0 ? grandTotal : 0,
    };
  }, [formItems, discount, tax]);

  // Validate item selling price warning
  const hasSellingPriceWarnings = useMemo(() => {
    return formItems.some((item) => item.selling_price < item.purchase_price);
  }, [formItems]);

  // Form submission
  const handleSubmit = async () => {
    if (typeof window !== "undefined" && !window.navigator.onLine) {
      toast.error("Operation not allowed while offline.");
      return;
    }
    if (!supplierId) {
      toast.error("Please select a supplier");
      return;
    }
    if (formItems.length === 0) {
      toast.error("Please add at least one product item");
      return;
    }

    // Check invalid quantities
    const invalidQty = formItems.some((item) => item.quantity <= 0);
    if (invalidQty) {
      toast.error("All item quantities must be greater than 0");
      return;
    }

    const payload = {
      supplier_id: supplierId,
      supplier_invoice_number: invoiceNumber || null,
      purchase_date: new Date(purchaseDate).toISOString(),
      discount: discount || 0,
      tax: tax || 0,
      payment_status: paymentStatus,
      payment_method: paymentMethod || null,
      notes: notes || null,
      items: formItems.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        purchase_price: item.purchase_price,
        selling_price: item.selling_price,
      })),
    };

    try {
      if (editId) {
        await updatePurchase(editId, payload);
        toast.success(`Purchase updated successfully`);
      } else {
        await createPurchase(payload);
        toast.success(`Purchase transaction recorded successfully`);
      }

      // Reset Form and reload
      handleResetForm();
      setActiveTab("history");
      handleRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to record purchase stock");
    }
  };

  // Load Edit targets
  const handleTriggerEdit = async (poId: number) => {
    try {
      const po = await getPurchaseById(poId);
      if (!po) {
        toast.error("Purchase order not found");
        return;
      }
      setEditId(poId);
      setSupplierId(Number(po.supplier_id));
      setInvoiceNumber(po.supplier_invoice_number || "");
      setPurchaseDate(new Date(po.purchase_date).toISOString().substring(0, 16));
      setNotes(po.notes || "");
      setPaymentStatus(po.payment_status);
      setPaymentMethod(po.payment_method || "Cash");
      setDiscount(po.discount / 100.0);
      setTax(po.tax / 100.0);

      // Map items
      const mapped = po.items.map((i: any) => ({
        product_id: i.product_id,
        name: i.product_name,
        sku: i.product_sku,
        barcode: i.product_barcode || "",
        quantity: i.quantity,
        purchase_price: i.purchase_price / 100.0,
        selling_price: i.selling_price / 100.0,
      }));
      setFormItems(mapped);

      setActiveTab("form");
    } catch (e) {
      toast.error("Failed to load purchase information");
    }
  };

  const handleResetForm = () => {
    setEditId(null);
    setSupplierId(null);
    setSupplierSearch("");
    setInvoiceNumber("");
    setPurchaseDate(new Date().toISOString().substring(0, 16));
    setNotes("");
    setPaymentStatus("Paid");
    setPaymentMethod("Cash");
    setDiscount(0);
    setTax(0);
    setFormItems([]);
  };

  // Local Pagination logic
  const paginatedPurchases = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return rawPurchases.slice(start, start + itemsPerPage);
  }, [rawPurchases, page]);
  const totalPages = Math.ceil(rawPurchases.length / itemsPerPage);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Purchase Stock</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage purchase records, stock intakes, and vendor costing rules.
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === "history" ? (
            <>
              <Button variant="outline" size="sm" className="rounded-xl h-11" onClick={handleRefresh}>
                <RefreshCw className="size-4" />
              </Button>
              <Button onClick={() => { handleResetForm(); setActiveTab("form"); }} className="h-11 rounded-xl">
                <Plus className="mr-2 size-4" /> New Purchase
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => { handleResetForm(); setActiveTab("history"); }} className="h-11 rounded-xl">
              Back to History
            </Button>
          )}
        </div>
      </div>

      {activeTab === "history" ? (
        <>
          {/* Statistics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card-soft p-4 flex items-center gap-3">
              <div className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center"><ShoppingBag className="size-5" /></div>
              <div>
                <div className="text-2xl font-bold tracking-tight text-foreground">{inr(stats.todayValue)}</div>
                <div className="text-[10px] text-muted-foreground font-medium">Today's Purchases</div>
              </div>
            </div>
            <div className="card-soft p-4 flex items-center gap-3">
              <div className="size-10 rounded-xl bg-teal-500/10 text-teal-500 grid place-items-center"><Receipt className="size-5" /></div>
              <div>
                <div className="text-2xl font-bold tracking-tight text-foreground">{stats.todayCount}</div>
                <div className="text-[10px] text-muted-foreground font-medium">Today's Count</div>
              </div>
            </div>
            <div className="card-soft p-4 flex items-center gap-3">
              <div className="size-10 rounded-xl bg-amber-500/10 text-amber-500 grid place-items-center"><DollarSign className="size-5" /></div>
              <div>
                <div className="text-2xl font-bold tracking-tight text-foreground">{inr(stats.totalValue)}</div>
                <div className="text-[10px] text-muted-foreground font-medium">Total Purchase Value</div>
              </div>
            </div>
            <div className="card-soft p-4 flex items-center gap-3">
              <div className="size-10 rounded-xl bg-purple-500/10 text-purple-500 grid place-items-center"><CalendarDays className="size-5" /></div>
              <div>
                <div className="text-2xl font-bold tracking-tight text-foreground">{stats.totalCount}</div>
                <div className="text-[10px] text-muted-foreground font-medium">Total Transactions</div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="card-soft p-3 flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by supplier, invoice #, or purchase #..."
                className="h-11 rounded-xl pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">From</span>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                  className="h-11 rounded-xl w-36"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">To</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                  className="h-11 rounded-xl w-36"
                />
              </div>
              {(startDate || endDate) && (
                <Button
                  variant="outline"
                  onClick={() => { setStartDate(""); setEndDate(""); setPage(1); }}
                  className="h-11 rounded-xl"
                >
                  Clear dates
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
              title="No purchases found"
              description="Record your vendor invoices and stock intakes to get started."
              action={<Button onClick={() => setActiveTab("form")}><Plus className="mr-2 size-4" /> New Purchase</Button>}
            />
          ) : (
            <div className="space-y-4">
              <div className="card-soft overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground uppercase">
                        <th className="p-4">Purchase No.</th>
                        <th className="p-4">Supplier</th>
                        <th className="p-4">Date</th>
                        <th className="p-4">Supplier Invoice</th>
                        <th className="p-4">Payment</th>
                        <th className="p-4 text-right">Total</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {paginatedPurchases.map((p: any) => (
                        <tr key={p.id} className="hover:bg-muted/10 transition-colors">
                          <td className="p-4 font-mono text-xs font-semibold text-primary">{p.purchase_number}</td>
                          <td className="p-4 font-medium">{p.supplier_name}</td>
                          <td className="p-4 text-xs text-muted-foreground">{formatLocalDate(p.purchase_date)}</td>
                          <td className="p-4 text-xs font-mono">{p.supplier_invoice_number || "-"}</td>
                          <td className="p-4">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              p.payment_status === "Paid"
                                ? "bg-emerald-500/10 text-emerald-500"
                                : p.payment_status === "Partially Paid"
                                ? "bg-amber-500/10 text-amber-500"
                                : "bg-rose-500/10 text-rose-500"
                            }`}>
                              {p.payment_status}
                            </span>
                            {p.payment_method && <span className="text-[10px] text-muted-foreground ml-1">({p.payment_method})</span>}
                          </td>
                          <td className="p-4 text-right font-semibold">{inr(p.grand_total / 100.0)}</td>
                          <td className="p-4 text-right flex justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-lg"
                              onClick={() => setDetailsId(p.id)}
                            >
                              View
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-lg"
                              onClick={() => handleTriggerEdit(p.id)}
                            >
                              <Pencil className="size-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-lg text-rose-500 hover:text-rose-500 hover:bg-rose-500/5 border-rose-500/20"
                              onClick={() => setDeleteTarget(p)}
                            >
                              <Trash2 className="size-3" />
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
        /* Purchase Entry / Form Tab */
        <div className="space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            {/* Left Block: Invoice Meta */}
            <div className="card-soft p-4 space-y-4 h-fit">
              <h2 className="text-base font-semibold text-foreground">Invoice Summary</h2>
              
              {/* Supplier Autocomplete */}
              <div className="space-y-1.5 relative">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Supplier</label>
                <div className="relative">
                  <Button
                    variant="outline"
                    className="w-full text-left justify-between h-11 rounded-xl bg-background"
                    onClick={() => setSupplierOpen(!supplierOpen)}
                  >
                    <span>{selectedSupplierName}</span>
                    <ArrowUpDown className="size-3 text-muted-foreground shrink-0" />
                  </Button>
                  {supplierOpen && (
                    <div className="absolute top-12 left-0 w-full bg-popover text-popover-foreground border border-border rounded-xl shadow-lg z-50 p-2 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Input
                          value={supplierSearch}
                          onChange={(e) => setSupplierSearch(e.target.value)}
                          placeholder="Search name or phone..."
                          className="h-9 rounded-lg"
                        />
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setNewSupplierName(supplierSearch);
                            setNewSupplierOpen(true);
                          }}
                          className="h-9 text-xs gap-1 shrink-0"
                        >
                          <Plus className="size-3.5" /> New
                        </Button>
                      </div>
                      <div className="max-h-40 overflow-y-auto divide-y divide-border/40">
                        {filteredSuppliers.length === 0 ? (
                          <div className="p-3 text-xs text-muted-foreground text-center space-y-2">
                            <div>No suppliers match "{supplierSearch}"</div>
                            <Button
                              size="sm"
                              onClick={() => {
                                setNewSupplierName(supplierSearch);
                                setNewSupplierOpen(true);
                              }}
                              className="w-full text-xs bg-primary text-primary-foreground"
                            >
                              <Plus className="mr-1.5 size-3.5" /> Create Supplier "{supplierSearch}"
                            </Button>
                          </div>
                        ) : (
                          filteredSuppliers.map((s: any) => (
                            <button
                              key={s.id}
                              onClick={() => {
                                setSupplierId(Number(s.id));
                                setSupplierSearch("");
                                setSupplierOpen(false);
                              }}
                              className="flex w-full items-center justify-between p-2.5 text-xs text-left hover:bg-muted rounded-lg"
                            >
                              <div>
                                <div className="font-semibold">{s.name}</div>
                                {s.phone && <div className="text-[10px] text-muted-foreground">{s.phone}</div>}
                              </div>
                              {supplierId === Number(s.id) && <Check className="size-4 text-primary" />}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Invoice Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Supplier Invoice #</label>
                <Input
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="e.g. INV/2026/001"
                  className="h-11 rounded-xl"
                />
              </div>

              {/* Purchase Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Purchase Date</label>
                <Input
                  type="datetime-local"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Notes</label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Internal notes, terms, carriage details..."
                  rows={2}
                  className="rounded-xl"
                />
              </div>
            </div>

            {/* Right Block: Items Table */}
            <div className="md:col-span-2 space-y-4">
              <div className="card-soft p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-foreground">Items Received</h2>
                  
                  {/* Product Search Autocomplete */}
                  <div className="relative min-w-[280px]">
                    <form onSubmit={handleBarcodeSubmit}>
                      <Input
                        id="product-autocomplete-input"
                        value={productSearch}
                        onChange={(e) => { setProductSearch(e.target.value); setProductOpen(true); }}
                        onFocus={() => setProductOpen(true)}
                        placeholder="Search product (scan barcode/name)..."
                        className="h-10 rounded-xl pr-8"
                      />
                      <Scan className="absolute right-3 top-3 size-4 text-muted-foreground" />
                    </form>
                    {productOpen && productSearch.trim() && (
                      <div className="absolute top-11 right-0 w-full bg-popover text-popover-foreground border border-border rounded-xl shadow-lg z-50 p-2">
                        <div className="max-h-56 overflow-y-auto divide-y divide-border/40">
                          {filteredProducts.length === 0 ? (
                            <div className="p-3 text-xs text-muted-foreground text-center">No products found</div>
                          ) : (
                            filteredProducts.map((p: any) => (
                              <button
                                key={p.id}
                                onClick={() => handleSelectProduct(p)}
                                className="flex w-full items-center justify-between p-2.5 text-xs text-left hover:bg-muted rounded-lg"
                              >
                                <div>
                                  <div className="font-semibold">{p.name}</div>
                                  <div className="text-[10px] text-muted-foreground font-mono">SKU: {p.sku} | Barcode: {p.barcode || "-"}</div>
                                </div>
                                <span className="text-[10px] font-semibold text-primary">{inr(p.purchase / 100.0)}</span>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto min-h-[200px]">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-muted/20 text-xs font-semibold text-muted-foreground uppercase">
                        <th className="p-3">Product Specifications</th>
                        <th className="p-3 w-20 text-center">Qty</th>
                        <th className="p-3 w-28 text-right">Cost Price (₹)</th>
                        <th className="p-3 w-28 text-right">Sell Price (₹)</th>
                        <th className="p-3 w-28 text-right">Total (₹)</th>
                        <th className="p-3 w-10 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {formItems.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-xs text-muted-foreground">
                            Use the product search bar above to add items to this purchase.
                          </td>
                        </tr>
                      ) : (
                        formItems.map((item, idx) => {
                          const warning = item.selling_price < item.purchase_price;
                          return (
                            <tr key={idx} className="hover:bg-muted/5 transition-colors">
                              <td className="p-3">
                                <div className="font-medium">{item.name}</div>
                                <div className="text-[10px] text-muted-foreground font-mono">SKU: {item.sku}</div>
                              </td>
                              <td className="p-3">
                                <Input
                                  type="number"
                                  min={1}
                                  value={item.quantity}
                                  onChange={(e) => updateItemField(idx, "quantity", parseInt(e.target.value, 10) || 0)}
                                  onKeyDown={(e) => handleKeyDown(e, idx, "qty")}
                                  className="h-9 rounded-lg text-center font-semibold tabular"
                                />
                              </td>
                              <td className="p-3">
                                <Input
                                  id={`purchase-price-${idx}`}
                                  type="number"
                                  step="0.01"
                                  min={0}
                                  value={item.purchase_price}
                                  onChange={(e) => updateItemField(idx, "purchase_price", parseFloat(e.target.value) || 0)}
                                  onKeyDown={(e) => handleKeyDown(e, idx, "purchase")}
                                  className="h-9 rounded-lg text-right font-semibold tabular"
                                />
                              </td>
                              <td className="p-3 relative">
                                <Input
                                  id={`selling-price-${idx}`}
                                  type="number"
                                  step="0.01"
                                  min={0}
                                  value={item.selling_price}
                                  onChange={(e) => updateItemField(idx, "selling_price", parseFloat(e.target.value) || 0)}
                                  onKeyDown={(e) => handleKeyDown(e, idx, "selling")}
                                  className={`h-9 rounded-lg text-right font-semibold tabular ${warning ? "border-amber-500 text-amber-500 bg-amber-500/5 focus:border-amber-500" : ""}`}
                                />
                                {warning && (
                                  <AlertTriangle className="absolute right-4 top-5 size-3.5 text-amber-500 pointer-events-none" />
                                )}
                              </td>
                              <td className="p-3 text-right font-semibold tabular">
                                {inr(item.quantity * item.purchase_price)}
                              </td>
                              <td className="p-3 text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-500"
                                  onClick={() => handleRemoveItem(idx)}
                                >
                                  <X className="size-4" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Calculations Footer */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Notes/Warnings */}
                <div className="card-soft p-4 space-y-3 bg-muted/20 border-dashed">
                  <h3 className="text-xs font-semibold text-foreground uppercase">Payment Status & Method</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                      <SelectTrigger className="h-10 rounded-lg">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Paid">Paid</SelectItem>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Partially Paid">Partially Paid</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger className="h-10 rounded-lg">
                        <SelectValue placeholder="Method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="UPI">UPI</SelectItem>
                        <SelectItem value="Card">Card</SelectItem>
                        <SelectItem value="NetBanking">NetBanking</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {hasSellingPriceWarnings && (
                    <div className="flex gap-2 p-2 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-lg text-xs">
                      <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                      <div>
                        <strong>Cost Warning:</strong> One or more items are configured with a selling price lower than their purchase cost.
                      </div>
                    </div>
                  )}
                </div>

                {/* Subtotals computation */}
                <div className="card-soft p-4 space-y-2 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal:</span>
                    <span className="font-semibold tabular-nums text-foreground">{inr(calculatedTotals.subtotal)}</span>
                  </div>
                  <div className="flex justify-between items-center text-muted-foreground gap-3">
                    <span className="flex items-center gap-1"><Percent className="size-3" /> Discount (₹):</span>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={discount || ""}
                      onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                      className="h-8 w-24 text-right rounded-lg tabular font-semibold"
                    />
                  </div>
                  <div className="flex justify-between items-center text-muted-foreground gap-3 border-b border-border/40 pb-2">
                    <span>Tax charges (₹):</span>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={tax || ""}
                      onChange={(e) => setTax(parseFloat(e.target.value) || 0)}
                      className="h-8 w-24 text-right rounded-lg tabular font-semibold"
                    />
                  </div>
                  <div className="flex justify-between text-base font-bold pt-1">
                    <span>Grand Total:</span>
                    <span className="text-primary tabular-nums">{inr(calculatedTotals.grandTotal)}</span>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" className="flex-1 rounded-xl h-11" onClick={handleResetForm}>
                      Reset
                    </Button>
                    <Button className="flex-1 rounded-xl h-11" onClick={handleSubmit}>
                      {editId ? "Save Changes" : "Save Purchase"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dialogs and Details Modal */}
      <Dialog open={detailsId !== null} onOpenChange={(v) => !v && setDetailsId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex justify-between items-center font-semibold">
              <span>Purchase Order Details</span>
              {purchaseDetails && (
                <span className="text-xs font-mono font-normal text-muted-foreground mr-4">
                  {purchaseDetails.purchase_number}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {isDetailsLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
          ) : purchaseDetails ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-xs bg-muted/20 p-3 rounded-xl border">
                <div>
                  <div className="text-muted-foreground font-medium uppercase text-[10px]">Supplier</div>
                  <div className="font-semibold text-foreground text-sm mt-0.5">{purchaseDetails.supplier_name}</div>
                </div>
                <div>
                  <div className="text-muted-foreground font-medium uppercase text-[10px]">Supplier Invoice Number</div>
                  <div className="font-semibold font-mono text-foreground text-sm mt-0.5">{purchaseDetails.supplier_invoice_number || "-"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground font-medium uppercase text-[10px]">Purchase Date</div>
                  <div className="font-medium text-foreground mt-0.5">{formatLocalDate(purchaseDetails.purchase_date)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground font-medium uppercase text-[10px]">Payment Information</div>
                  <div className="mt-0.5">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      purchaseDetails.payment_status === "Paid"
                        ? "bg-emerald-500/10 text-emerald-500"
                        : purchaseDetails.payment_status === "Partially Paid"
                        ? "bg-amber-500/10 text-amber-500"
                        : "bg-rose-500/10 text-rose-500"
                    }`}>
                      {purchaseDetails.payment_status}
                    </span>
                    {purchaseDetails.payment_method && <span className="text-[10px] text-muted-foreground ml-1">({purchaseDetails.payment_method})</span>}
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Line Items</div>
                <div className="border border-border rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border font-semibold text-muted-foreground uppercase text-[10px]">
                        <th className="p-3">Product specifications</th>
                        <th className="p-3 text-center">Qty</th>
                        <th className="p-3 text-right">Cost (₹)</th>
                        <th className="p-3 text-right">Sell (₹)</th>
                        <th className="p-3 text-right">Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {purchaseDetails.items?.map((item: any) => (
                        <tr key={item.id}>
                          <td className="p-3">
                            <div className="font-semibold text-foreground">{item.product_name}</div>
                            <div className="text-[10px] text-muted-foreground font-mono">SKU: {item.product_sku}</div>
                          </td>
                          <td className="p-3 text-center font-medium tabular-nums">{item.quantity}</td>
                          <td className="p-3 text-right tabular-nums">{inr(item.purchase_price / 100.0)}</td>
                          <td className="p-3 text-right tabular-nums">{inr(item.selling_price / 100.0)}</td>
                          <td className="p-3 text-right font-semibold tabular-nums">{inr(item.line_total / 100.0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total calculations */}
              <div className="flex flex-col items-end gap-1.5 text-xs text-muted-foreground border-t border-border pt-3">
                <div className="flex justify-between w-48">
                  <span>Subtotal:</span>
                  <span className="font-medium text-foreground">{inr(purchaseDetails.subtotal / 100.0)}</span>
                </div>
                <div className="flex justify-between w-48">
                  <span>Discount:</span>
                  <span className="font-medium text-rose-500">-{inr(purchaseDetails.discount / 100.0)}</span>
                </div>
                <div className="flex justify-between w-48">
                  <span>Tax:</span>
                  <span className="font-medium text-foreground">+{inr(purchaseDetails.tax / 100.0)}</span>
                </div>
                <div className="flex justify-between w-48 text-sm font-bold border-t border-border/40 pt-1.5">
                  <span className="text-foreground">Grand Total:</span>
                  <span className="text-primary">{inr(purchaseDetails.grand_total / 100.0)}</span>
                </div>
              </div>

              {purchaseDetails.notes && (
                <div className="bg-muted/10 p-3 rounded-xl border border-dashed text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-foreground block mb-0.5">Notes:</strong>
                  {purchaseDetails.notes}
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete purchase order {deleteTarget?.purchase_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently delete this purchase order record and **automatically reverse the stock updates** of all items associated with it (subtracting the quantities from the inventory). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-danger-foreground hover:bg-danger/90"
              onClick={async () => {
                if (deleteTarget) {
                  try {
                    await deletePurchase(deleteTarget.id);
                    toast.success(`Purchase order "${deleteTarget.purchase_number}" deleted and stock reversed`);
                    handleRefresh();
                  } catch (e) {
                    toast.error("Failed to delete purchase order");
                  }
                }
                setDeleteTarget(null);
              }}
            >
              Confirm Reversal & Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Quick Create Supplier Dialog */}
      <Dialog open={newSupplierOpen} onOpenChange={setNewSupplierOpen}>
        <DialogContent className="sm:max-w-md">
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
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Phone</label>
                <Input
                  placeholder="Mobile number"
                  value={newSupplierPhone}
                  onChange={(e) => setNewSupplierPhone(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase text-muted-foreground">GSTIN</label>
                <Input
                  placeholder="22AAAAA0000A1Z5"
                  value={newSupplierGstin}
                  onChange={(e) => setNewSupplierGstin(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewSupplierOpen(false)}>Cancel</Button>
            <Button onClick={handleQuickCreateSupplier} className="bg-primary text-primary-foreground">
              Save Supplier & Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
