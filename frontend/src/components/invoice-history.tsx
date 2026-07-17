import { useState, useEffect, useRef } from "react";
import { useApp } from "@/lib/store";
import { getSalesPaginated, getCustomers } from "@/lib/api";
import { InvoiceCard } from "./invoice-card";
import { InvoiceDrawer } from "./invoice-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { CalendarIcon, Search, SlidersHorizontal, RefreshCw, X, Loader2, Info } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

export function InvoiceHistory({
  customerId,
}: {
  customerId?: string | number;
}) {
  const customers = useApp((s) => s.customers);
  const setCustomers = useApp((s) => s.setCustomers);

  // Load customers if not loaded
  useEffect(() => {
    if (customers.length === 0) {
      getCustomers().then(setCustomers).catch(() => {});
    }
  }, [customers, setCustomers]);

  // Search & Filters State
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [payment, setPayment] = useState("ALL");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("ALL");
  const [dateFilter, setDateFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [sort, setSort] = useState("newest");

  // Pagination & List State
  const [invoices, setInvoices] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Drawer State
  const [selectedInvoiceNumber, setSelectedInvoiceNumber] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Ref for scroll container to anchor context
  const containerRef = useRef<HTMLDivElement>(null);
  const prevScrollTop = useRef(0);

  // Auto reset list and fetch page 1 on filter or search changes
  useEffect(() => {
    let active = true;
    const fetchFirstPage = async () => {
      setLoading(true);
      try {
        const queryParams: any = {
          page: 1,
          limit: 10,
          search,
          status: status === "ALL" ? undefined : status,
          paymentMethod: payment === "ALL" ? undefined : payment,
          customerId: (customerId !== undefined)
            ? (typeof customerId === "string" ? parseInt(customerId, 10) : customerId)
            : (selectedCustomerId === "ALL" ? undefined : parseInt(selectedCustomerId, 10)),
          dateFilter: dateFilter === "all" ? undefined : dateFilter,
          sort,
        };

        if (dateFilter === "custom" && dateRange?.from) {
          queryParams.startDate = format(dateRange.from, "yyyy-MM-dd");
          if (dateRange.to) {
            queryParams.endDate = format(dateRange.to, "yyyy-MM-dd");
          }
        }

        const res = await getSalesPaginated(queryParams);
        if (active) {
          setInvoices(res.data);
          setTotalPages(res.pagination.totalPages);
          setTotalCount(res.pagination.totalCount);
          setPage(1);
        }
      } catch (err: any) {
        toast.error("Failed to fetch invoices: " + err.message);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchFirstPage();

    return () => {
      active = false;
    };
  }, [search, status, payment, selectedCustomerId, dateFilter, dateRange, sort, customerId]);

  // Load More Function
  const handleLoadMore = async () => {
    if (page >= totalPages) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const queryParams: any = {
        page: nextPage,
        limit: 10,
        search,
        status: status === "ALL" ? undefined : status,
        paymentMethod: payment === "ALL" ? undefined : payment,
        customerId: (customerId !== undefined)
          ? (typeof customerId === "string" ? parseInt(customerId, 10) : customerId)
          : (selectedCustomerId === "ALL" ? undefined : parseInt(selectedCustomerId, 10)),
        dateFilter: dateFilter === "all" ? undefined : dateFilter,
        sort,
      };

      if (dateFilter === "custom" && dateRange?.from) {
        queryParams.startDate = format(dateRange.from, "yyyy-MM-dd");
        if (dateRange.to) {
          queryParams.endDate = format(dateRange.to, "yyyy-MM-dd");
        }
      }

      const res = await getSalesPaginated(queryParams);
      setInvoices((prev) => [...prev, ...res.data]);
      setPage(nextPage);
    } catch (err: any) {
      toast.error("Failed to load more invoices: " + err.message);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleInvoiceClick = (invoiceNumber: string) => {
    // Record current scroll position
    if (containerRef.current) {
      prevScrollTop.current = containerRef.current.scrollTop;
    } else {
      prevScrollTop.current = window.scrollY;
    }
    setSelectedInvoiceNumber(invoiceNumber);
    setDrawerOpen(true);
  };

  const handleDrawerClose = (open: boolean) => {
    setDrawerOpen(open);
    if (!open) {
      // Restore scroll position after drawer close animation completes
      setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = prevScrollTop.current;
        } else {
          window.scrollTo({ top: prevScrollTop.current, behavior: "instant" as any });
        }
      }, 50);
    }
  };

  const resetFilters = () => {
    setSearch("");
    setStatus("ALL");
    setPayment("ALL");
    setSelectedCustomerId("ALL");
    setDateFilter("all");
    setDateRange(undefined);
    setSort("newest");
  };

  return (
    <div id="invoice-history" className="space-y-4" ref={containerRef}>
      {/* Search and Main Filters Row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search invoice #, customer name, phone, payment method, status..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10 rounded-xl bg-surface border-border text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Sort Select */}
        <div className="w-full sm:w-[180px]">
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="h-10 rounded-xl bg-surface text-xs font-semibold">
              <SelectValue placeholder="Sort Invoices" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="highest_amount">Highest Amount</SelectItem>
              <SelectItem value="lowest_amount">Lowest Amount</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Advanced Filters Segment */}
      <div className="card-soft p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-border/40 pb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
            <SlidersHorizontal className="size-3.5" /> Filters
          </div>
          {(search || status !== "ALL" || payment !== "ALL" || selectedCustomerId !== "ALL" || dateFilter !== "all" || sort !== "newest") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="h-7 text-[10px] text-muted-foreground hover:text-foreground rounded-lg"
            >
              Clear All
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
          {/* Status Filter */}
          <div className="space-y-1">
            <label className="font-semibold text-muted-foreground">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 rounded-xl bg-surface text-[11px] font-medium border-border">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="VOID">Void</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Payment Method Filter */}
          <div className="space-y-1">
            <label className="font-semibold text-muted-foreground">Payment Method</label>
            <Select value={payment} onValueChange={setPayment}>
              <SelectTrigger className="h-9 rounded-xl bg-surface text-[11px] font-medium border-border">
                <SelectValue placeholder="All Payments" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="ALL">All Payments</SelectItem>
                <SelectItem value="Cash">Cash</SelectItem>
                <SelectItem value="UPI">UPI</SelectItem>
                <SelectItem value="Card">Card</SelectItem>
                <SelectItem value="Wallet">Wallet</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date Presets Filter */}
          <div className="space-y-1">
            <label className="font-semibold text-muted-foreground">Date Range</label>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="h-9 rounded-xl bg-surface text-[11px] font-medium border-border">
                <SelectValue placeholder="All Time" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="last7">Last 7 Days</SelectItem>
                <SelectItem value="thisMonth">This Month</SelectItem>
                <SelectItem value="custom">Custom Date</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Customer Selection Filter (if not locked in context) */}
          {!customerId ? (
            <div className="space-y-1">
              <label className="font-semibold text-muted-foreground">Customer</label>
              <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                <SelectTrigger className="h-9 rounded-xl bg-surface text-[11px] font-medium border-border">
                  <SelectValue placeholder="All Customers" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="ALL">All Customers</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="font-semibold text-muted-foreground">Customer</label>
              <div className="h-9 flex items-center px-3 border border-border rounded-xl bg-muted/30 text-[11px] text-muted-foreground font-semibold">
                Locked Profile
              </div>
            </div>
          )}
        </div>

        {/* Custom Date Range Picker */}
        {dateFilter === "custom" && (
          <div className="pt-2 flex items-center gap-2 animate-fade-in">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl text-[11px] font-medium border-border h-9 bg-surface text-muted-foreground flex gap-1.5"
                >
                  <CalendarIcon className="size-3.5 text-muted-foreground" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      `${format(dateRange.from, "d MMM yyyy")} – ${format(dateRange.to, "d MMM yyyy")}`
                    ) : (
                      format(dateRange.from, "d MMM yyyy")
                    )
                  ) : (
                    "Select date range"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-0 rounded-2xl">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={1}
                  className="p-3"
                />
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      {/* Stats Counter */}
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-semibold px-1">
        <Info className="size-3 text-muted-foreground/60" />
        <span>
          Found <span className="text-foreground font-bold">{totalCount}</span> transaction records.
        </span>
      </div>

      {/* Invoices List */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/10 p-8 text-center">
          <div className="text-sm font-semibold text-foreground">No transactions logged</div>
          <div className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Try adjusting your search queries or clearing filter presets.
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {invoices.map((invoice) => (
            <InvoiceCard
              key={invoice.id}
              invoice={invoice}
              onClick={() => handleInvoiceClick(invoice.invoice_number)}
            />
          ))}
        </div>
      )}

      {/* Load More Button */}
      {page < totalPages && !loading && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="rounded-xl px-6 h-10 border-border bg-surface text-xs font-semibold text-muted-foreground hover:text-foreground transition-all flex gap-1.5"
          >
            {loadingMore ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : null}
            {loadingMore ? "Loading Invoices..." : "Load More Invoices"}
          </Button>
        </div>
      )}

      {/* Centralized Invoice Drawer Component */}
      <InvoiceDrawer
        invoiceNumber={selectedInvoiceNumber}
        open={drawerOpen}
        onOpenChange={handleDrawerClose}
      />
    </div>
  );
}
