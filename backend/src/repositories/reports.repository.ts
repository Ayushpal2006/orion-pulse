import db from "../database/db";

export class ReportsRepository {
  private getDateCondition(filter: string, startDate?: string, endDate?: string) {
    let clause = "1=1";
    const params: any = {};

    switch (filter) {
      case "today":
        clause = "date(created_at, 'localtime') = date('now', 'localtime')";
        break;
      case "yesterday":
        clause = "date(created_at, 'localtime') = date('now', '-1 day', 'localtime')";
        break;
      case "last7":
        clause = "date(created_at, 'localtime') >= date('now', '-6 days', 'localtime')";
        break;
      case "last30":
        clause = "date(created_at, 'localtime') >= date('now', '-29 days', 'localtime')";
        break;
      case "thisMonth":
        clause = "strftime('%Y-%m', created_at, 'localtime') = strftime('%Y-%m', 'now', 'localtime')";
        break;
      case "lastMonth":
        clause = "strftime('%Y-%m', created_at, 'localtime') = strftime('%Y-%m', 'now', '-1 month', 'localtime')";
        break;
      case "thisYear":
        clause = "strftime('%Y', created_at, 'localtime') = strftime('%Y', 'now', 'localtime')";
        break;
      case "custom":
        if (startDate) {
          const actualEnd = endDate || startDate;
          clause = "date(created_at, 'localtime') >= date($startDate) AND date(created_at, 'localtime') <= date($endDate)";
          params.$startDate = startDate;
          params.$endDate = actualEnd;
        }
        break;
    }
    return { clause, params };
  }

  getSummary(filter: string, startDate?: string, endDate?: string) {
    const { clause, params } = this.getDateCondition(filter, startDate, endDate);

    // 1. Revenue
    const revStmt = db.prepare(`
      SELECT COALESCE(SUM(grand_total), 0) as total 
      FROM sales 
      WHERE ${clause}
    `);
    const revenue = (revStmt.get(params) as { total: number }).total;

    // 2. Orders
    const orderStmt = db.prepare(`
      SELECT COUNT(*) as count 
      FROM sales 
      WHERE ${clause}
    `);
    const orders = (orderStmt.get(params) as { count: number }).count;

    // 3. Profit
    const profitStmt = db.prepare(`
      SELECT COALESCE(SUM(si.line_total - (p.purchase_price * si.quantity)), 0) as profit
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      WHERE s.is_active = 1 AND ${clause.replace(/created_at/g, "s.created_at")}
    `);
    const profit = (profitStmt.get(params) as { profit: number }).profit;

    return {
      revenue: revenue / 100.0,
      orders,
      profit: profit / 100.0,
      averageOrderValue: orders > 0 ? (revenue / orders) / 100.0 : 0,
    };
  }

  getTopProducts(filter: string, startDate?: string, endDate?: string) {
    const { clause, params } = this.getDateCondition(filter, startDate, endDate);
    const stmt = db.prepare(`
      SELECT p.name, SUM(si.quantity) as unitsSold, SUM(si.line_total) as revenue
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      WHERE ${clause.replace(/created_at/g, "s.created_at")}
      GROUP BY si.product_id
      ORDER BY unitsSold DESC
      LIMIT 10
    `);
    const rows = stmt.all(params) as { name: string; unitsSold: number; revenue: number }[];
    return rows.map((r) => ({
      name: r.name,
      unitsSold: r.unitsSold,
      revenue: r.revenue / 100.0,
    }));
  }

  getGstSummary(filter: string, startDate?: string, endDate?: string) {
    const { clause, params } = this.getDateCondition(filter, startDate, endDate);
    const stmt = db.prepare(`
      SELECT p.gst as slab,
             SUM(si.line_total) as taxable,
             SUM(si.line_total * p.gst / 100.0) as tax
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      WHERE ${clause.replace(/created_at/g, "s.created_at")}
      GROUP BY p.gst
      ORDER BY p.gst ASC
    `);
    const rows = stmt.all(params) as { slab: number; taxable: number; tax: number }[];
    return rows.map((r) => ({
      slab: `${r.slab}%`,
      taxable: r.taxable / 100.0,
      tax: Math.round(r.tax) / 100.0,
    }));
  }

  getPaymentSplit(filter: string, startDate?: string, endDate?: string) {
    const { clause, params } = this.getDateCondition(filter, startDate, endDate);
    const stmt = db.prepare(`
      SELECT payment_method as paymentMethod, SUM(grand_total) as amount
      FROM sales
      WHERE ${clause}
      GROUP BY payment_method
    `);
    const rows = stmt.all(params) as { paymentMethod: string; amount: number }[];
    const result: Record<string, number> = { Cash: 0, UPI: 0, Card: 0, Wallet: 0 };
    for (const r of rows) {
      result[r.paymentMethod] = r.amount / 100.0;
    }
    return result;
  }

  getTrendSeries(filter: string, startDate?: string, endDate?: string) {
    const { clause, params } = this.getDateCondition(filter, startDate, endDate);

    // Grouping interval logic based on filters
    if (filter === "today" || filter === "yesterday") {
      const stmt = db.prepare(`
        SELECT strftime('%H', created_at, 'localtime') as hr, SUM(grand_total) as amount
        FROM sales
        WHERE ${clause}
        GROUP BY hr
        ORDER BY hr ASC
      `);
      const rows = stmt.all(params) as { hr: string; amount: number }[];
      
      // Pre-populate standard hours: 9 AM to 6 PM (9a to 6p)
      const hoursMap = new Map<number, number>();
      for (let h = 9; h <= 18; h++) {
        hoursMap.set(h, 0);
      }
      for (const r of rows) {
        const hourNum = parseInt(r.hr, 10);
        if (hoursMap.has(hourNum)) {
          hoursMap.set(hourNum, r.amount / 100.0);
        } else {
          // If transaction happened outside 9am-6p, add it to closest or keep it
          hoursMap.set(hourNum, r.amount / 100.0);
        }
      }

      const formatHourLabel = (h: number): string => {
        if (h === 0) return "12a";
        if (h < 12) return `${h}a`;
        if (h === 12) return "12p";
        return `${h - 12}p`;
      };

      const sortedHours = Array.from(hoursMap.keys()).sort((a, b) => a - b);
      return sortedHours.map((h) => ({
        label: formatHourLabel(h),
        value: hoursMap.get(h) || 0,
      }));
    }

    if (filter === "thisYear") {
      const stmt = db.prepare(`
        SELECT strftime('%m', created_at, 'localtime') as mnth, SUM(grand_total) as amount
        FROM sales
        WHERE ${clause}
        GROUP BY mnth
        ORDER BY mnth ASC
      `);
      const rows = stmt.all(params) as { mnth: string; amount: number }[];
      
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthsMap = new Map<number, number>();
      for (let m = 1; m <= 12; m++) {
        monthsMap.set(m, 0);
      }
      for (const r of rows) {
        monthsMap.set(parseInt(r.mnth, 10), r.amount / 100.0);
      }

      return Array.from(monthsMap.keys()).map((m) => ({
        label: monthNames[m - 1],
        value: monthsMap.get(m) || 0,
      }));
    }

    // Default: Group by Date (Last 7 Days, Last 30 Days, This Month, Last Month, Custom)
    const stmt = db.prepare(`
      SELECT date(created_at, 'localtime') as dy, SUM(grand_total) as amount
      FROM sales
      WHERE ${clause}
      GROUP BY dy
      ORDER BY dy ASC
    `);
    const rows = stmt.all(params) as { dy: string; amount: number }[];
    const salesMap = new Map<string, number>();
    for (const r of rows) {
      salesMap.set(r.dy, r.amount / 100.0);
    }

    // Generate date sequence in JS to populate days with 0 sales
    const dates: string[] = [];
    const now = new Date();
    
    let startLocalDate = new Date();
    let endLocalDate = new Date();

    if (filter === "last7") {
      startLocalDate.setDate(now.getDate() - 6);
    } else if (filter === "last30") {
      startLocalDate.setDate(now.getDate() - 29);
    } else if (filter === "thisMonth") {
      startLocalDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (filter === "lastMonth") {
      startLocalDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endLocalDate = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (filter === "custom" && startDate) {
      startLocalDate = new Date(startDate);
      endLocalDate = new Date(endDate || startDate);
    } else {
      // default fallback last 7 days
      startLocalDate.setDate(now.getDate() - 6);
    }

    const current = new Date(startLocalDate);
    while (current <= endLocalDate) {
      const dateStr = current.toISOString().substring(0, 10);
      dates.push(dateStr);
      current.setDate(current.getDate() + 1);
    }

    return dates.map((d) => {
      const dateObj = new Date(d);
      // Format: "4 Jul" or abbreviated day names for last7
      const label = filter === "last7" 
        ? dateObj.toLocaleDateString("en-IN", { weekday: "short" }) 
        : dateObj.toLocaleDateString("en-IN", { day: "numeric", month: "short" });

      return {
        label,
        value: salesMap.get(d) || 0,
      };
    });
  }

  getRecentInvoices(filter: string, startDate?: string, endDate?: string) {
    const { clause, params } = this.getDateCondition(filter, startDate, endDate);
    const stmt = db.prepare(`
      SELECT s.invoice_number as id, 
             s.created_at as date,
             s.payment_method as payment,
             s.grand_total as total
      FROM sales s
      WHERE ${clause}
      ORDER BY s.id DESC
      LIMIT 100
    `);
    const rows = stmt.all(params) as { id: string; date: string; payment: string; total: number }[];
    return rows.map((r) => ({
      id: r.id,
      date: new Date(r.date).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
      payment: r.payment,
      total: r.total / 100.0,
    }));
  }
}
