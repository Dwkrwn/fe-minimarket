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

import { apiCall } from "@/lib/api";
import { type ItemNotification } from "./item/service.item";
import { type PRNotification } from "./pr/service.pr";
import { type PONotification } from "./po/service.po";
import { type PINotification } from "./pi/service.pi";
import { type PurchaseReturnNotification } from "./purchase_retrun/service.preturn";
import { type PenerimaanGudangNotification } from "./t_penerimaan_gudang/service.penerimaan_gudang";
import { type SupplierNotification } from "./supplier/service.supplier";
import { type StockOpnameNotification } from "./stock_opname/service.stock_opname";

// ============================================================================
// COMBINED TYPES
// ============================================================================

export type NotificationItem = (
  | ItemNotification
  | PRNotification
  | PONotification
  | PINotification
  | PurchaseReturnNotification
  | PenerimaanGudangNotification
  | SupplierNotification
  | StockOpnameNotification
) & {
  notification_type?:
    | "items"
    | "purchase_request"
    | "purchase_order"
    | "purchase_invoice"
    | "purchase_return"
    | "penerimaan_gudang"
    | "supplier"
    | "stock_opname";
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
  t_purchase_order_id?: string;
  t_purchase_invoice_id?: string;
  t_purchase_return_id?: string;
  t_penerimaan_gudang_id?: string;
  t_stock_opname_id?: string;
  m_supplier_id?: string;
  t_stock_adj_id?: string;
  m_item?: ItemNotification["m_item"];
  t_purchase_request?: PRNotification["t_purchase_request"];
  user_default?: { id?: string; name?: string } | null;
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
      notification_type: item.notification_type || "purchase_request",
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
