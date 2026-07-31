// Module 7: Workflow Approval Engine for Apka Bill V2

export type ApprovalType = "purchase" | "stock_transfer" | "price_change" | "discount" | "void_sale" | "refund";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface WorkflowApprovalRequest {
  id: string;
  type: ApprovalType;
  referenceId: string;
  requestedBy: string;
  details: string;
  amount?: number;
  status: ApprovalStatus;
  reviewedBy?: string;
  reviewNotes?: string;
  requestedAt: string;
  reviewedAt?: string;
}

export class WorkflowApprovalService {
  private static instance: WorkflowApprovalService;
  private requests: WorkflowApprovalRequest[] = [];

  public static getInstance(): WorkflowApprovalService {
    if (!WorkflowApprovalService.instance) {
      WorkflowApprovalService.instance = new WorkflowApprovalService();
    }
    return WorkflowApprovalService.instance;
  }

  requestApproval(input: {
    type: ApprovalType;
    referenceId: string;
    requestedBy: string;
    details: string;
    amount?: number;
  }): WorkflowApprovalRequest {
    const req: WorkflowApprovalRequest = {
      id: `APP-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: input.type,
      referenceId: input.referenceId,
      requestedBy: input.requestedBy,
      details: input.details,
      amount: input.amount,
      status: "pending",
      requestedAt: new Date().toISOString(),
    };
    this.requests.unshift(req);
    console.log(`[WorkflowApproval] Approval requested for ${input.type} (${input.referenceId}) by ${input.requestedBy}`);
    return req;
  }

  reviewRequest(requestId: string, status: "approved" | "rejected", reviewedBy: string, notes?: string): WorkflowApprovalRequest {
    const req = this.requests.find((r) => r.id === requestId);
    if (!req) throw new Error("Approval request not found");

    req.status = status;
    req.reviewedBy = reviewedBy;
    req.reviewNotes = notes;
    req.reviewedAt = new Date().toISOString();

    console.log(`[WorkflowApproval] Request ${requestId} reviewed: ${status} by ${reviewedBy}`);
    return req;
  }

  getPendingRequests(): WorkflowApprovalRequest[] {
    return this.requests.filter((r) => r.status === "pending");
  }
}

export const workflowApprovalService = WorkflowApprovalService.getInstance();
