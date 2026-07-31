// Module 1: Multi-Store Stock Transfer & Reconciliation Engine for Apka Bill V2

export type TransferStatus = "requested" | "approved" | "in_transit" | "received" | "rejected" | "cancelled";

export interface StockTransferItem {
  productId: number;
  productName: string;
  sku: string;
  quantity: number;
  batchNumber?: string;
}

export interface StockTransferRequest {
  id: string;
  transferNumber: string;
  sourceStoreId: number;
  sourceStoreName: string;
  targetStoreId: number;
  targetStoreName: string;
  items: StockTransferItem[];
  status: TransferStatus;
  requestedBy: string;
  approvedBy?: string;
  receivedBy?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export class StockTransferService {
  private static instance: StockTransferService;
  private transfers: StockTransferRequest[] = [];

  public static getInstance(): StockTransferService {
    if (!StockTransferService.instance) {
      StockTransferService.instance = new StockTransferService();
    }
    return StockTransferService.instance;
  }

  createTransferRequest(input: {
    sourceStoreId: number;
    sourceStoreName: string;
    targetStoreId: number;
    targetStoreName: string;
    items: StockTransferItem[];
    requestedBy: string;
    notes?: string;
  }): StockTransferRequest {
    const id = `TRF-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const transfer: StockTransferRequest = {
      id,
      transferNumber: `TRF-${Date.now()}`,
      sourceStoreId: input.sourceStoreId,
      sourceStoreName: input.sourceStoreName,
      targetStoreId: input.targetStoreId,
      targetStoreName: input.targetStoreName,
      items: input.items,
      status: "requested",
      requestedBy: input.requestedBy,
      notes: input.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.transfers.unshift(transfer);
    console.log(`[StockTransfer] Created transfer request ${transfer.transferNumber} from Store #${input.sourceStoreId} to Store #${input.targetStoreId}`);
    return transfer;
  }

  approveTransfer(transferId: string, approvedBy: string): StockTransferRequest {
    const trf = this.transfers.find((t) => t.id === transferId);
    if (!trf) throw new Error("Transfer request not found");
    if (trf.status !== "requested") throw new Error(`Cannot approve transfer in ${trf.status} status`);

    trf.status = "approved";
    trf.approvedBy = approvedBy;
    trf.updatedAt = new Date().toISOString();
    console.log(`[StockTransfer] Transfer ${trf.transferNumber} approved by ${approvedBy}`);
    return trf;
  }

  dispatchTransit(transferId: string): StockTransferRequest {
    const trf = this.transfers.find((t) => t.id === transferId);
    if (!trf) throw new Error("Transfer request not found");
    if (trf.status !== "approved") throw new Error("Transfer must be approved before dispatching to transit");

    trf.status = "in_transit";
    trf.updatedAt = new Date().toISOString();
    console.log(`[StockTransfer] Transfer ${trf.transferNumber} is now IN TRANSIT`);
    return trf;
  }

  receiveTransfer(transferId: string, receivedBy: string): StockTransferRequest {
    const trf = this.transfers.find((t) => t.id === transferId);
    if (!trf) throw new Error("Transfer request not found");
    if (trf.status !== "in_transit") throw new Error("Transfer must be in transit to receive");

    trf.status = "received";
    trf.receivedBy = receivedBy;
    trf.updatedAt = new Date().toISOString();
    console.log(`[StockTransfer] Transfer ${trf.transferNumber} RECEIVED at Store #${trf.targetStoreId} by ${receivedBy}`);
    return trf;
  }

  getTransfersForStore(storeId: number): StockTransferRequest[] {
    return this.transfers.filter((t) => t.sourceStoreId === storeId || t.targetStoreId === storeId);
  }
}

export const stockTransferService = StockTransferService.getInstance();
