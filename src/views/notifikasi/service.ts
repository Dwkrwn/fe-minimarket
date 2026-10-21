// ============================================================================
// COMBINED SERVICE - Re-exports from individual services
// ============================================================================

// Re-export from item service
export {
  type ItemNotification,
  type ItemNotificationResponse,
  getItemsNotifications,
  getRevisiNotifications as getItemRevisiNotifications,
  markItemNotificationAsRead,
  approveItemNotification,
  reviseItem,
  updateItemStatus,
} from "./item/service.item";

// Re-export from PR service
export {
  type PRNotification,
  type PRNotificationResponse,
  getPurchaseRequestNotifications,
  getPRRevisiNotifications,
  getPRPendingApprovalNotifications,
  getPRCombinedSenderNotifications,
  markPRNotificationAsRead,
  approvePurchaseRequest,
  revisePurchaseRequest,
} from "./pr/service.pr";

// Re-export from PO service
export {
  type PONotification,
  type PONotificationResponse,
  getPurchaseOrderNotifications,
  getPORevisiNotifications,
  getPOPendingApprovalNotifications,
  getPOCombinedSenderNotifications,
  markPONotificationAsRead,
  approvePurchaseOrder,
  revisePurchaseOrder,
  rejectPurchaseOrder,
} from "./po/service.po";

// Re-export from PI service
export {
  type PINotification,
  type PINotificationResponse,
  getPurchaseInvoiceNotifications,
  getPIRevisiNotifications,
  getPIPendingApprovalNotifications,
  getPICombinedSenderNotifications,
  markPINotificationAsRead,
  approvePurchaseInvoice,
  revisePurchaseInvoice,
  rejectPurchaseInvoice,
} from "./pi/service.pi";

// Re-export from Purchase Request Close service
export {
  type TPurchaseRequestCloseNotification,
  type TPurchaseRequestCloseNotificationResponse,
  getTPurchaseRequestCloseNotifications,
  getTPurchaseRequestCloseRevisiNotifications,
  getPendingTPurchaseRequestCloseNotifications,
  getTPurchaseRequestCloseCombinedSenderNotifications,
  markTPurchaseRequestCloseNotificationAsRead,
  approveTPurchaseRequestClose,
  reviseTPurchaseRequestClose,
  rejectTPurchaseRequestClose,
} from "./purchase_request_close/service.purchase_request_close";

// Re-export from Purchase Return service
export {
  type PurchaseReturnNotification,
  type PurchaseReturnNotificationResponse,
  getPurchaseReturnNotifications,
  getPurchaseReturnRevisiNotifications,
  getPurchaseReturnPendingApprovalNotifications,
  getPurchaseReturnCombinedSenderNotifications,
  markPurchaseReturnNotificationAsRead,
  approvePurchaseReturn,
  revisePurchaseReturn,
  rejectPurchaseReturn,
} from "./purchase_retrun/service.preturn";

// Re-export from Penerimaan Gudang service
export {
  type PenerimaanGudangNotification,
  type PenerimaanGudangNotificationResponse,
  getPenerimaanGudangNotifications,
  getPenerimaanGudangRevisiNotifications,
  getPenerimaanGudangPendingApprovalNotifications,
  getPenerimaanGudangCombinedSenderNotifications,
  markPenerimaanGudangNotificationAsRead,
  approvePenerimaanGudang,
  revisePenerimaanGudang,
  rejectPenerimaanGudang,
} from "./t_penerimaan_gudang/service.penerimaan_gudang";

// Re-export from Supplier service
export {
  type SupplierNotification,
  type SupplierNotificationResponse,
  getSupplierNotifications,
  getSupplierRevisiNotifications,
  getSupplierPendingApprovalNotifications,
  getSupplierCombinedSenderNotifications,
  markSupplierNotificationAsRead,
  approveSupplier,
  reviseSupplier,
  rejectSupplier,
} from "./supplier/service.supplier";

// Re-export from Stock Opname service
export {
  type StockOpnameNotification,
  type StockOpnameNotificationResponse,
  getStockOpnameNotifications,
  getStockOpnameRevisiNotifications,
  getPendingStockOpnameNotifications,
  getStockOpnameCombinedSenderNotifications,
  markStockOpnameNotificationAsRead,
  approveStockOpname,
  reviseStockOpname,
  rejectStockOpname,
} from "./stock_opname/service.stock_opname";

// Re-export from Stock Adj service
export {
  type StockAdjNotification,
  type StockAdjNotificationResponse,
  getStockAdjNotifications,
  getStockAdjRevisiNotifications,
  getPendingStockAdjNotifications,
  getStockAdjCombinedSenderNotifications,
  markStockAdjNotificationAsRead,
  approveStockAdj,
  reviseStockAdj,
  rejectStockAdj,
} from "./stock_adjustment/service.stock_adj";

// Re-export from Transfer Gudang service
export {
  type TransferGudangNotification,
  type TransferGudangNotificationResponse,
  getTransferGudangNotifications,
  getTransferGudangRevisiNotifications,
  getPendingTransferGudangNotifications,
  getTransferGudangCombinedSenderNotifications,
  markTransferGudangNotificationAsRead,
  approveTransferGudangNotification,
  reviseTransferGudangNotification,
  rejectTransferGudangNotification,
} from "./transfer_gudang/service.transfer_gudang";

// Re-export from Purchase Request Subcon service
export {
  type PurchaseRequestSubconNotification,
  type PurchaseRequestSubconNotificationResponse,
  getPurchaseRequestSubconNotifications,
  markPurchaseRequestSubconNotificationAsRead,
  approvePurchaseRequestSubcon,
  revisePurchaseRequestSubcon,
  rejectPurchaseRequestSubcon,
} from "./purchase_request_subcon/service.purchase_request_subcon";

// Re-export from Purchase Order Subcon service
export {
  type PurchaseOrderSubconNotification,
  type PurchaseOrderSubconNotificationResponse,
  getPurchaseOrderSubconNotifications,
  markPurchaseOrderSubconNotificationAsRead,
  approvePurchaseOrderSubcon,
  revisePurchaseOrderSubcon,
  rejectPurchaseOrderSubcon,
} from "./service.purchase_order_subcon";

// Re-export from Purchase Invoice Subcon service
export {
  type PurchaseInvoiceSubconNotification,
  type PurchaseInvoiceSubconNotificationResponse,
  getPurchaseInvoiceSubconNotifications,
  markPurchaseInvoiceSubconNotificationAsRead,
  approvePurchaseInvoiceSubcon,
  revisePurchaseInvoiceSubcon,
  rejectPurchaseInvoiceSubcon,
} from "./purchase_invoice_subcon/service.purchase_invoice_subcon";

// Re-export from Purchase Return Subcon service
export {
  type PurchaseReturnSubconNotification,
  type PurchaseReturnSubconNotificationResponse,
  getPurchaseReturnSubconNotifications,
  markPurchaseReturnSubconNotificationAsRead,
  approvePurchaseReturnSubcon,
  revisePurchaseReturnSubcon,
  rejectPurchaseReturnSubcon,
} from "./service.purchase_return_subcon";

import { apiCall } from "@/lib/api";
import {
  getItemsNotifications,
  getRevisiNotifications as getItemRevisiNotificationsInternal,
  type ItemNotification,
} from "./item/service.item";
import {
  getTPurchaseOrderCloseNotifications,
  getPendingTPurchaseOrderCloseNotifications,
  getTPurchaseOrderCloseRevisiNotifications,
  getTPurchaseOrderCloseCombinedSenderNotifications,
  type TPurchaseOrderCloseNotification,
} from "./purchase_order_close/service.purchase_order_close";
import {
  getPurchaseRequestNotifications,
  getPRRevisiNotifications,
  getPRPendingApprovalNotifications,
  getPRCombinedSenderNotifications,
  type PRNotification,
} from "./pr/service.pr";
import {
  getPurchaseOrderNotifications,
  getPORevisiNotifications,
  getPOPendingApprovalNotifications,
  getPOCombinedSenderNotifications,
  type PONotification,
} from "./po/service.po";
import {
  getPurchaseInvoiceNotifications,
  getPIRevisiNotifications,
  getPIPendingApprovalNotifications,
  type PINotification,
} from "./pi/service.pi";
import {
  getTPurchaseRequestCloseNotifications,
  getTPurchaseRequestCloseRevisiNotifications,
  getPendingTPurchaseRequestCloseNotifications,
  type TPurchaseRequestCloseNotification,
} from "./purchase_request_close/service.purchase_request_close";
import {
  getPurchaseReturnNotifications,
  getPurchaseReturnRevisiNotifications,
  getPurchaseReturnPendingApprovalNotifications,
  type PurchaseReturnNotification,
} from "./purchase_retrun/service.preturn";
import {
  getPenerimaanGudangNotifications,
  getPenerimaanGudangRevisiNotifications,
  getPenerimaanGudangPendingApprovalNotifications,
  type PenerimaanGudangNotification,
} from "./t_penerimaan_gudang/service.penerimaan_gudang";
import {
  getSupplierNotifications,
  getSupplierRevisiNotifications,
  getSupplierPendingApprovalNotifications,
  type SupplierNotification,
} from "./supplier/service.supplier";
import {
  getStockOpnameNotifications,
  getStockOpnameRevisiNotifications,
  getPendingStockOpnameNotifications,
  type StockOpnameNotification,
} from "./stock_opname/service.stock_opname";
import {
  getStockAdjNotifications,
  getStockAdjRevisiNotifications,
  getPendingStockAdjNotifications,
  type StockAdjNotification,
} from "./stock_adjustment/service.stock_adj";
import {
  getTransferGudangNotifications,
  getTransferGudangRevisiNotifications,
  getPendingTransferGudangNotifications,
  type TransferGudangNotification,
} from "./transfer_gudang/service.transfer_gudang";
import { type PurchaseRequestSubconNotification } from "./purchase_request_subcon/service.purchase_request_subcon";
import { type IoNotification } from "./service.io";
import { type PurchaseOrderSubconNotification } from "./service.purchase_order_subcon";
import { type PurchaseInvoiceSubconNotification } from "./purchase_invoice_subcon/service.purchase_invoice_subcon";
import { type PurchaseReturnSubconNotification } from "./service.purchase_return_subcon";

// ============================================================================
// COMBINED TYPES
// ============================================================================

export type NotificationItem = (
  | ItemNotification
  | PRNotification
  | TransferGudangNotification
  | PurchaseRequestSubconNotification
  | PurchaseOrderSubconNotification
  | PurchaseInvoiceSubconNotification
  | PurchaseReturnSubconNotification
  | IoNotification
) & {
  notification_type?:
    | "items"
    | "purchase_request"
    | "purchase_order"
    | "purchase_invoice"
    | "purchase_request_close"
    | "purchase_order_close"
    | "purchase_return"
    | "io"
    | "penerimaan_gudang"
    | "supplier"
    | "stock_opname"
    | "stock_adj"
    | "transfer_gudang"
    | "transform_item"
    | "purchase_request_subcon"
    | "purchase_order_subcon"
    | "purchase_invoice_subcon"
    | "purchase_return_subcon";
  notification_category?: "approval" | "outstanding" | "info";
  info_type?: "revisi" | "pending_approval" | "stock_opname_lock" | string;
  outstanding_type?: "purchase_request" | "purchase_order" | string;
  ref_id?: string;
  no_transaksi?: string;
  tgl_transaksi?: string;
  total_qty?: number;
  total_qty_ots?: number;
  total_item_outstanding?: number;
  nama_supplier?: string;
  nama_gudang?: string;
  nama_unit_bisnis?: string;
  // For compatibility - include both m_item and t_purchase_request
  m_items_id?: string;
  t_purchase_request_id?: string;
  t_purchase_request_subcon_id?: string;
  t_purchase_order_subcon_id?: string;
  t_purchase_invoice_subcon_id?: string;
  t_purchase_return_subcon_id?: string;
  t_transfer_gudang_id?: string;
  m_item?: ItemNotification["m_item"];
  t_purchase_request?: PRNotification["t_purchase_request"];
  t_purchase_request_subcon?: PurchaseRequestSubconNotification["t_purchase_request_subcon"];
  t_purchase_order_subcon?: PurchaseOrderSubconNotification["t_purchase_order_subcon"];
  t_purchase_invoice_subcon?: PurchaseInvoiceSubconNotification["t_purchase_invoice_subcon"];
  t_transfer_gudang?: TransferGudangNotification["t_transfer_gudang"];
};

export interface NotificationResponse {
  data: NotificationItem[];
  status: string;
  approval?: NotificationItem[];
  pagination?: {
    total: number;
    page: number;
    totalPages: number;
    limit: number;
    currentRowsCount: number;
    next_page: number | null;
    prev_page: number | null;
  };
}

export interface UnifiedNotificationResponse {
  status: string;
  data: {
    all: NotificationItem[];
    approval: NotificationItem[];
    outstanding: NotificationItem[];
    info: NotificationItem[];
    revisi?: NotificationItem[];
    pending_approval?: NotificationItem[];
  };
  counts?: {
    all: number;
    approval: number;
    outstanding: number;
    info: number;
    revisi?: number;
    pending_approval?: number;
    total?: number;
  };
  active_ids?: string[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getUserId(): string {
  const authData = localStorage.getItem("auth_bb");
  if (authData) {
    try {
      const parsed = JSON.parse(authData);
      return parsed.user?.id || "";
    } catch (e) {
      console.error("Failed to parse auth data:", e);
    }
  }
  return "";
}

type UnifiedNotificationCache = {
  key: string;
  expiresAt: number;
  payload: UnifiedNotificationResponse;
};

type UnifiedNotificationInFlight = {
  key: string;
  promise: Promise<UnifiedNotificationResponse>;
};

let unifiedNotificationCache: UnifiedNotificationCache | null = null;
let unifiedNotificationInFlight: UnifiedNotificationInFlight | null = null;

export function clearUnifiedNotificationCache() {
  unifiedNotificationCache = null;
  unifiedNotificationInFlight = null;
}

function normalizeUnifiedRows(items: any[]): NotificationItem[] {
  return (items || [])
    .map((item: any) => ({
      ...item,
      notification_type:
        item.notification_type ||
        (item.t_purchase_order_subcon_id || item.t_purchase_order_subcon
          ? "purchase_order_subcon"
          : item.t_purchase_invoice_subcon_id || item.t_purchase_invoice_subcon
            ? "purchase_invoice_subcon"
            : item.t_purchase_return_subcon_id || item.t_purchase_return_subcon
              ? "purchase_return_subcon"
              : item.t_purchase_request_subcon_id ||
                  item.t_purchase_request_subcon
                ? "purchase_request_subcon"
                : "purchase_request"),
    }))
    .sort(
      (a, b) =>
        new Date(b.createdAt || b.updatedAt || 0).getTime() -
        new Date(a.createdAt || a.updatedAt || 0).getTime(),
    ) as NotificationItem[];
}


export async function getUnifiedNotifications(
  page = 1,
  limit = 100,
  forceRefresh = false,
  type: "all" | "approval" | "outstanding" | "info" = "all",
): Promise<UnifiedNotificationResponse> {
  const userId = getUserId();
  if (!userId) {
    throw new Error("User not authenticated");
  }

  const cacheKey = `${userId}:${page}:${limit}:${type}`;
  const now = Date.now();

  if (forceRefresh) {
    unifiedNotificationCache = null;
  }

  if (
    !forceRefresh &&
    unifiedNotificationCache &&
    unifiedNotificationCache.key === cacheKey &&
    unifiedNotificationCache.expiresAt > now
  ) {
    return unifiedNotificationCache.payload;
  }

  if (
    !forceRefresh &&
    unifiedNotificationInFlight &&
    unifiedNotificationInFlight.key === cacheKey
  ) {
    return unifiedNotificationInFlight.promise;
  }

  const requestPromise = (async () => {
    const response = await apiCall<any>(
      `/fn/notifikasi_controller/getUnifiedNotifications?id=${userId}&page=${page}&limit=${limit}&type=${type}`,
      { method: "GET" },
    );

    const infoRows = normalizeUnifiedRows(response.data?.info || []);

    const payload: UnifiedNotificationResponse = {
      status: response.status || "success",
      data: {
        all: normalizeUnifiedRows(response.data?.all || []),
        approval: normalizeUnifiedRows(response.data?.approval || []),
        outstanding: normalizeUnifiedRows(response.data?.outstanding || []),
        info: infoRows,
        revisi: normalizeUnifiedRows(
          response.data?.revisi ||
            infoRows.filter(
              (item) =>
                item.info_type === "revisi" || item.status_name === "REVISI",
            ),
        ),
        pending_approval: normalizeUnifiedRows(
          response.data?.pending_approval ||
            infoRows.filter(
              (item) =>
                item.info_type === "pending_approval" ||
                item.status_name === "IN APPROVAL",
            ),
        ),
      },
      counts: response.counts,
      active_ids: Array.isArray(response.active_ids)
        ? response.active_ids.map((id: any) => String(id))
        : [],
    };

    unifiedNotificationCache = {
      key: cacheKey,
      expiresAt: Date.now() + 10000,
      payload,
    };

    return payload;
  })();

  unifiedNotificationInFlight = {
    key: cacheKey,
    promise: requestPromise,
  };

  try {
    return await requestPromise;
  } finally {
    if (unifiedNotificationInFlight?.key === cacheKey) {
      unifiedNotificationInFlight = null;
    }
  }
}

// ============================================================================
// COMBINED API FUNCTIONS
// ============================================================================

/**
 * Get all notifications (Items + Purchase Request) combined
 */
export async function getNotifications(
  page = 1,
  limit = 10,
): Promise<NotificationResponse> {
  const unified = await getUnifiedNotifications(page, limit);
  const combinedData = unified.data.approval || [];

  return {
    status: "success",
    data: combinedData,
    pagination: {
      total: combinedData.length,
      page: 1,
      totalPages: 1,
      limit: combinedData.length,
      currentRowsCount: combinedData.length,
      next_page: null,
      prev_page: null,
    },
  };
}

/**
 * Mark notification as read through unified notification endpoint.
 * Only real *_notifikasi records are persisted. Derived rows like outstanding
 * and stock opname lock can be skipped by backend.
 */
export async function markUnifiedNotificationAsRead(
  notif: Pick<
    NotificationItem,
    "id" | "notification_type" | "notification_category" | "info_type"
  >,
): Promise<any> {
  return apiCall(`/fn/notifikasi_controller/markAsRead`, {
    method: "POST",
    body: JSON.stringify({
      id: notif.id,
      notification_type: notif.notification_type,
      notification_category: notif.notification_category,
      info_type: notif.info_type,
    }),
  });
}

/**
 * Mark notification as read (for backward compatibility)
 */
export async function markNotificationAsRead(id: string): Promise<any> {
  return apiCall(`/dynamic/m_items_notifikasi`, {
    method: "POST",
    body: JSON.stringify({
      id,
      status: true,
    }),
  });
}

/**
 * Approve notification (for backward compatibility - items only)
 */
export async function approveNotification(
  id: string,
  approval_level: number,
  approval_catatan?: string,
): Promise<any> {
  return apiCall(`/dynamic/m_items_notifikasi/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      approval_level,
      approval_catatan,
    }),
  });
}

/**
 * Get all revisi notifications (Items + Purchase Request) combined
 * This is for the sender to see when their items/PRs are revised (status = REVISI only)
 */
export async function getRevisiNotifications(
  page = 1,
  limit = 10,
): Promise<NotificationResponse> {
  const unified = await getUnifiedNotifications(page, limit);
  const combinedData = unified.data.revisi || [];

  return {
    status: "success",
    data: combinedData,
    pagination: {
      total: combinedData.length,
      page: 1,
      totalPages: 1,
      limit: combinedData.length,
      currentRowsCount: combinedData.length,
      next_page: null,
      prev_page: null,
    },
  };
}

/**
 * Get all pending approval notifications (status = IN APPROVAL)
 * This is for the sender to see when their items/PRs are waiting for approval
 */
export async function getPendingApprovalNotifications(
  page = 1,
  limit = 10,
): Promise<NotificationResponse> {
  const unified = await getUnifiedNotifications(page, limit);
  const combinedData = unified.data.pending_approval || [];

  return {
    status: "success",
    data: combinedData,
    pagination: {
      total: combinedData.length,
      page: 1,
      totalPages: 1,
      limit: combinedData.length,
      currentRowsCount: combinedData.length,
      next_page: null,
      prev_page: null,
    },
  };
}

// Re-export from IO service
export {
  type IoNotification,
  type IoNotificationResponse,
  getIoNotifications,
  getIoRevisiNotifications,
  getPendingIoNotifications,
  getIoCombinedSenderNotifications,
  markIoNotificationAsRead,
  approveIo,
  reviseIo,
  rejectIo,
} from "./service.io";

// Re-export from WO service
export {
  type WoNotification,
  type WoNotificationResponse,
  getWoNotifications,
  getWoRevisiNotifications,
  getPendingWoNotifications,
  getWoCombinedSenderNotifications,
  markWoNotificationAsRead,
  approveWo,
  reviseWo,
  rejectWo,
} from "./wo/service.wo";
