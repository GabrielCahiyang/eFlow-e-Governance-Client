export type PettyAction =
  | 'replenish'
  | 'request'
  | 'approve'
  | 'reject'
  | 'cancel'
  | 'release'
  | 'receipts'
  | 'endorse'
  | 'return_receipts'
  | 'acknowledge_return'
  | 'approve_return'
  | 'settle';

export interface OfficeReceipt {
  vendor: string;
  number: string;
  date: string;
  amount: number;
  path: string;
  description?: string;
  originLabel?: string;
  locked?: boolean;
  approvedByName?: string;
}

export interface OfficeAssignmentReceipt {
  id: string;
  assignmentId: string;
  taskTitle: string;
  subtaskTitle?: string | null;
  vendor: string;
  number: string;
  date: string;
  amount: number;
  path: string;
  description?: string;
  uploadedByName?: string;
  receiptReviewStatus?: string;
  locked?: boolean;
  accountingDecidedByName?: string;
}

export interface OfficeCashRequest {
  id: string;
  requester: string;
  requesterName: string;
  purpose: string;
  amount: number;
  spent?: number;
  returned_amount?: number;
  assignedAmount?: number;
  assignmentReceipts?: OfficeAssignmentReceipt[];
  status: string;
  receipts: OfficeReceipt[];
  created_at?: string;
  released_at?: string | null;
  liquidation_due_at?: string | null;
  refund_receipt_number?: string | null;
  refund_date?: string | null;
  liquidation_note?: string | null;
  receipt_version?: number;
  cash_return_version?: number | null;
  cash_return_received_by?: string | null;
  cash_return_received_at?: string | null;
  cash_return_receive_reference?: string | null;
  cash_return_approved_by?: string | null;
  cash_return_approved_at?: string | null;
  cash_return_approval_note?: string | null;
  cashReturnReceivedByName?: string | null;
  cashReturnApprovedByName?: string | null;
  returnClearanceRequired?: boolean;
  returnReceived?: boolean;
  returnApproved?: boolean;
  returnHeadFallback?: boolean;
  canAcknowledgeReturn?: boolean;
  canApproveReturn?: boolean;
  canSettle?: boolean;
  headCanSettle?: boolean;
  settlementBlocked?: boolean;
  headNotified?: boolean;
}

export interface OfficeCashEvent {
  id: number;
  action: string;
  amount: number;
  reference: string;
  actorName: string;
  created_at: string;
}

export interface OfficeCashSnapshot {
  ceiling: number;
  receiptLimit: number;
  cash: number;
  reserved: number;
  available: number;
  outstanding: number;
  replenishable: number;
  requests: OfficeCashRequest[];
  events: OfficeCashEvent[];
}

export interface OfficeCashCommand {
  key: string;
  action: PettyAction;
  data: Record<string, unknown>;
}
