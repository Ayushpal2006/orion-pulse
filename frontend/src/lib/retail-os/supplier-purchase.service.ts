// Module 4 & 5: Supplier & Purchase Platform Engine for Apka Bill V2

export type PurchaseOrderStatus =
  | "Draft"
  | "Pending"
  | "Approved"
  | "Ordered"
  | "Received"
  | "Partial Received"
  | "Completed"
  | "Cancelled";

export interface PurchaseOrderItem {
  productId: number;
  productName: string;
  sku: string;
  qtyOrdered: number;
  qtyReceived: number;
  unitPrice: number;
  taxRate: number;
  subtotal: number;
}

export interface PurchaseOrderRequest {
  id: string;
  poNumber: string;
  supplierId: number;
  supplierName: string;
  storeId: number;
  status: PurchaseOrderStatus;
  items: PurchaseOrderItem[];
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  createdBy: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export class SupplierPurchaseService {
  private static instance: SupplierPurchaseService;
  private purchaseOrders: PurchaseOrderRequest[] = [];

  public static getInstance(): SupplierPurchaseService {
    if (!SupplierPurchaseService.instance) {
      SupplierPurchaseService.instance = new SupplierPurchaseService();
    }
    return SupplierPurchaseService.instance;
  }

  createPurchaseOrder(input: {
    supplierId: number;
    supplierName: string;
    storeId: number;
    items: PurchaseOrderItem[];
    createdBy: string;
  }): PurchaseOrderRequest {
    const subtotal = input.items.reduce((a, b) => a + b.subtotal, 0);
    const taxTotal = Math.round(subtotal * 0.18); // Default 18% GST estimate
    const grandTotal = subtotal + taxTotal;

    const po: PurchaseOrderRequest = {
      id: `PO-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      poNumber: `PO-${Date.now()}`,
      supplierId: input.supplierId,
      supplierName: input.supplierName,
      storeId: input.storeId,
      status: "Draft",
      items: input.items,
      subtotal,
      taxTotal,
      grandTotal,
      createdBy: input.createdBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.purchaseOrders.unshift(po);
    console.log(`[PurchaseService] Created Purchase Order ${po.poNumber} for Supplier ${input.supplierName}`);
    return po;
  }

  updatePoStatus(poId: string, newStatus: PurchaseOrderStatus, approvedBy?: string): PurchaseOrderRequest {
    const po = this.purchaseOrders.find((p) => p.id === poId);
    if (!po) throw new Error("Purchase Order not found");

    po.status = newStatus;
    if (approvedBy) po.approvedBy = approvedBy;
    po.updatedAt = new Date().toISOString();

    console.log(`[PurchaseService] Purchase Order ${po.poNumber} status updated to: ${newStatus}`);
    return po;
  }

  getPurchaseOrders(): PurchaseOrderRequest[] {
    return this.purchaseOrders;
  }
}

export const supplierPurchaseService = SupplierPurchaseService.getInstance();
