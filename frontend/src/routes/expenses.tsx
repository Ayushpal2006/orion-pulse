import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import {
  CreditCard, Plus, Search, Calendar, RefreshCw, Trash2, Edit3, Download, FileSpreadsheet, Tag, DollarSign, Wallet, Building2, User, ChevronLeft, ChevronRight, Filter, AlertCircle
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  DialogFooter
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/empty-state";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getExpenses, getExpenseSummary, getExpenseCategories, createExpense, updateExpense, deleteExpense, createExpenseCategory, API_BASE_URL
} from "@/lib/api";

export const Route = createFileRoute("/expenses")({
  head: () => ({
    meta: [
      { title: "Expenses Management · Orion POS" },
      { name: "description", content: "Track store operational expenses, rent, salaries, utilities, and maintain financial records." },
    ],
  }),
  component: ExpensesPage,
});

function ExpensesPage() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  // Dialog states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any | null>(null);

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Form states
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [amountRupees, setAmountRupees] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [vendor, setVendor] = useState("");
  const [description, setDescription] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQ(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [q]);

  // Queries
  const { data: categories = [] } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: () => getExpenseCategories(),
  });

  const { data: expensesList = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["expenses", selectedCategory, startDate, endDate],
    queryFn: () => getExpenses({
      categoryId: selectedCategory === "all" ? undefined : Number(selectedCategory),
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    }),
  });

  const { data: summaryData } = useQuery({
    queryKey: ["expense-summary"],
    queryFn: () => getExpenseSummary(),
  });

  // Client side search and payment filter
  const filteredExpenses = useMemo(() => {
    return expensesList.filter((item: any) => {
      if (paymentFilter !== "all" && item.payment_method !== paymentFilter) return false;
      if (debouncedQ.trim()) {
        const query = debouncedQ.toLowerCase();
        const categoryMatch = (item.category_name || "").toLowerCase().includes(query);
        const vendorMatch = (item.vendor || "").toLowerCase().includes(query);
        const descMatch = (item.description || "").toLowerCase().includes(query);
        const amountMatch = (item.amount / 100).toString().includes(query);
        return categoryMatch || vendorMatch || descMatch || amountMatch;
      }
      return true;
    });
  }, [expensesList, paymentFilter, debouncedQ]);

  const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage) || 1;
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return filteredExpenses.slice(start, start + itemsPerPage);
  }, [filteredExpenses, page]);

  // Totals calculations
  const totalAmountPaise = useMemo(() => {
    return filteredExpenses.reduce((sum: number, item: any) => sum + (item.amount || 0), 0);
  }, [filteredExpenses]);

  const openAddModal = () => {
    setEditingExpense(null);
    setCategoryId(categories[0]?.id || "");
    setAmountRupees("");
    setPaymentMethod("Cash");
    setVendor("");
    setDescription("");
    setExpenseDate(new Date().toISOString().split("T")[0]);
    setModalOpen(true);
  };

  const openEditModal = (expense: any) => {
    setEditingExpense(expense);
    const cat = categories.find((c: any) => c.name === expense.category_name);
    setCategoryId(cat?.id || "");
    setAmountRupees((expense.amount / 100).toString());
    setPaymentMethod(expense.payment_method || "Cash");
    setVendor(expense.vendor || "");
    setDescription(expense.description || "");
    setExpenseDate(expense.date ? new Date(expense.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]);
    setModalOpen(true);
  };

  const handleSaveExpense = async () => {
    if (!categoryId) {
      toast.error("Please select an expense category");
      return;
    }
    const amt = parseFloat(amountRupees);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Please enter a valid expense amount (> 0)");
      return;
    }

    const payload = {
      categoryId: Number(categoryId),
      amount: Math.round(amt * 100), // convert to paise
      paymentMethod,
      vendor: vendor.trim() || null,
      description: description.trim() || null,
      date: expenseDate ? new Date(expenseDate).toISOString() : new Date().toISOString(),
    };

    try {
      if (editingExpense) {
        await updateExpense(editingExpense.id, payload);
        toast.success("Expense updated successfully");
      } else {
        await createExpense(payload);
        toast.success("Expense recorded successfully");
      }
      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expense-summary"] });
      queryClient.invalidateQueries({ queryKey: ["profit-summary"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to save expense");
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error("Category name cannot be empty");
      return;
    }
    try {
      const created = await createExpenseCategory(newCategoryName.trim());
      toast.success(`Category "${created.name}" created`);
      setNewCategoryName("");
      setCategoryModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
      setCategoryId(created.id);
    } catch (err: any) {
      toast.error(err.message || "Failed to create category");
    }
  };

  const handleDeleteExpense = async () => {
    if (!deleteId) return;
    try {
      await deleteExpense(deleteId);
      toast.success("Expense deleted successfully");
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expense-summary"] });
      queryClient.invalidateQueries({ queryKey: ["profit-summary"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to delete expense");
    }
  };

  const handleExportCSV = () => {
    window.open(`${API_BASE_URL}/api/export/expenses`, "_blank");
  };

  const formatLocalDate = (isoStr: string) => {
    if (!isoStr) return "-";
    try {
      return new Date(isoStr).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CreditCard className="size-6 text-primary" /> Expenses & Overheads
          </h1>
          <p className="text-sm text-muted-foreground">
            Track operational spending, recurring utility bills, salaries, and store overheads.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2">
            <Download className="size-4" /> Export CSV
          </Button>
          <Button size="sm" onClick={openAddModal} className="gap-2 bg-primary text-primary-foreground">
            <Plus className="size-4" /> Add Expense
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Wallet className="size-4 text-primary" /> Filtered Expenses Total
          </div>
          <div className="mt-2 text-3xl font-black text-foreground">
            ₹{(totalAmountPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{filteredExpenses.length} entries matching current view</div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Building2 className="size-4 text-emerald-500" /> Current Month Total
          </div>
          <div className="mt-2 text-3xl font-black text-emerald-600 dark:text-emerald-400">
            ₹{(summaryData?.totalAmount_INR || (totalAmountPaise / 100)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">Operational outflow this period</div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Tag className="size-4 text-indigo-500" /> Categories Tracked
          </div>
          <div className="mt-2 text-3xl font-black text-foreground">
            {categories.length}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">Rent, Electricity, Salary, Marketing etc.</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search vendor, description, amount..."
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedCategory} onValueChange={(v) => { setSelectedCategory(v); setPage(1); }}>
            <SelectTrigger className="w-[170px]">
              <Tag className="mr-2 size-4 text-muted-foreground" />
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((c: any) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={paymentFilter} onValueChange={(v) => { setPaymentFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[160px]">
              <Wallet className="mr-2 size-4 text-muted-foreground" />
              <SelectValue placeholder="All Methods" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Methods</SelectItem>
              <SelectItem value="Cash">Cash</SelectItem>
              <SelectItem value="UPI">UPI</SelectItem>
              <SelectItem value="Card">Card</SelectItem>
              <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
              <SelectItem value="Cheque">Cheque</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1.5 rounded-xl border border-border bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground">
            <Calendar className="size-3.5" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="bg-transparent outline-none"
            />
            <span>to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="bg-transparent outline-none"
            />
          </div>
        </div>
      </div>

      {/* Expense Data Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {isLoading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
            <RefreshCw className="size-6 animate-spin text-primary" />
            <span className="text-sm font-medium">Loading store expenses...</span>
          </div>
        ) : paginatedRows.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="No Expense Records Found"
            description="Start logging store expenses or clear active search and category filters."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5">Category</th>
                  <th className="px-5 py-3.5">Vendor / Payee</th>
                  <th className="px-5 py-3.5">Description</th>
                  <th className="px-5 py-3.5">Payment Method</th>
                  <th className="px-5 py-3.5 text-right">Amount (₹)</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedRows.map((row: any) => (
                  <tr key={row.id} className="transition-colors hover:bg-muted/30">
                    <td className="whitespace-nowrap px-5 py-3.5 font-medium text-foreground">
                      {formatLocalDate(row.date)}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                        {row.category_name}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-foreground">
                      {row.vendor || <span className="text-muted-foreground italic">N/A</span>}
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground max-w-xs truncate">
                      {row.description || <span className="italic opacity-60">No notes</span>}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-muted-foreground font-medium">
                      {row.payment_method}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                      ₹{(row.amount / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-foreground"
                          onClick={() => openEditModal(row)}
                        >
                          <Edit3 className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                          onClick={() => setDeleteId(row.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
            <div>
              Page {page} of {totalPages} ({filteredExpenses.length} total entries)
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Expense Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="size-5 text-primary" />
              {editingExpense ? "Edit Expense Entry" : "Record New Store Expense"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category *</label>
                <Button variant="link" size="sm" onClick={() => setCategoryModalOpen(true)} className="h-auto p-0 text-xs text-primary">
                  + Add Category
                </Button>
              </div>
              <Select value={String(categoryId)} onValueChange={(v) => setCategoryId(Number(v))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select expense category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount (₹) *</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={amountRupees}
                  onChange={(e) => setAmountRupees(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payment Method</label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="UPI">UPI</SelectItem>
                    <SelectItem value="Card">Card</SelectItem>
                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    <SelectItem value="Cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vendor / Payee</label>
                <Input
                  placeholder="e.g. Landlord, EB Board"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</label>
                <Input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description / Remarks</label>
              <Textarea
                placeholder="Details of the expense..."
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveExpense} className="bg-primary text-primary-foreground">
              {editingExpense ? "Update Expense" : "Save Expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add New Category Dialog */}
      <Dialog open={categoryModalOpen} onOpenChange={setCategoryModalOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="size-4 text-primary" /> Create Expense Category
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Input
              placeholder="e.g. Internet, Cleaning, Audit"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryModalOpen(false)}>Cancel</Button>
            <Button onClick={handleAddCategory} className="bg-primary text-primary-foreground">Create Category</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertCircle className="size-5" /> Confirm Expense Deletion
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this expense record? This operation will update store expense calculations and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteExpense} className="bg-rose-600 text-white hover:bg-rose-700">
              Delete Record
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
