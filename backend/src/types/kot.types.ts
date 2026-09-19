export interface KotItemDTO {
  id?: number;
  kotId?: number;
  productId: number;
  productName: string;
  quantity: number;
  notes?: string | null;
  createdAt?: string;
}

export interface KotDTO {
  id: number;
  organizationId: number | null;
  storeId: number;
  saleId: number;
  kotNumber: number;
  status: 'PENDING' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';
  tableNo?: string | null;
  orderType: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  notes?: string | null;
  printedAt?: string | null;
  reprintCount: number;
  createdAt: string;
  updatedAt: string;
  items: KotItemDTO[];
  invoiceNumber?: string;
}

export interface CreateKotInput {
  saleId: number;
  tableNo?: string;
  orderType?: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  notes?: string;
  items: {
    productId: number;
    productName: string;
    quantity: number;
    notes?: string;
  }[];
}

export interface UpdateKotStatusInput {
  status: 'PENDING' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';
}
